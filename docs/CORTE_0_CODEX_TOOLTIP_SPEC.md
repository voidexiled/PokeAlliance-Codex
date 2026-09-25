# Corte 0 v2 · Especificación del rediseño Alliance Codex

**Estado:** implementado y verificado técnicamente, salvo Comercio fase B (M14, en curso); aceptación visual pendiente (S22). El propietario aprobó el diseño (lienzo v5 y sistema de diseño) el 2026-09-19.
**Fecha:** 2026-09-19
**Reemplaza:**
- La versión 1 de este archivo, «Codex Tooltip» (2026-09-18). Las respuestas del propietario de v1 §1.3–§1.5 siguen vigentes con la consecuencia que les da §1.2; el resto de v1 queda sin efecto salvo lo que §1.4 declara vigente. v1 no tenía commit; su copia está en «Copias locales».
- `docs/DESIGN_DIRECTION.md` (2026-09-11).
- `DESIGN.md` (front matter y reglas visuales) y `.impeccable/design.json`.
- La parte visual de D-010 (Poppins e Inter en todo el sitio, azul grafito, acciones azules). La regla contra el relleno de D-010 sigue vigente (R12).

**Fuente de verdad visual:**
- Lienzo v5 «Diseño Alliance Codex», 9 tableros: https://claude.ai/artifact/AA7ujE9mRRKsMBWriyNxFH
- Sistema de diseño (DS): https://claude.ai/artifact/RJoXBjrTVJHCyTZNFmKS5C. `tokens.json` con 110 tokens y 22 estilos de texto, `README.md`, `guias/*.md` y 65 componentes con su `README.md`.
- `docs/design/CARD_GRID_SYSTEM.md`.

**Lugar en el roadmap:** reabre el gate de diseño de la Fase 3A. Los hitos de `docs/CONTENT_PLAN.md` que construyen páginas públicas (H2 en adelante) esperan a este corte; H0, H1A y H1B (solo datos) no.

## Índice

- [0. Resumen](#0-resumen)
- [1. Decisiones](#1-decisiones)
- [2. Objetivos y criterios de salida](#2-objetivos-y-criterios-de-salida)
- [3. Arquitectura CSS y tokens](#3-arquitectura-css-y-tokens)
- [4. Tipografía y números](#4-tipografía-y-números)
- [5. Forma, espaciado, puntos de corte y marco](#5-forma-espaciado-puntos-de-corte-y-marco)
- [6. Movimiento](#6-movimiento)
- [7. Componentes](#7-componentes)
- [8. Páginas de la wiki](#8-páginas-de-la-wiki)
- [9. Comercio](#9-comercio)
- [10. Guild](#10-guild)
- [11. Comparar Pokémon](#11-comparar-pokémon)
- [12. Barrido anti-slop y sin procedencia](#12-barrido-anti-slop-y-sin-procedencia)
- [13. i18n, SEO, rendimiento y accesibilidad](#13-i18n-seo-rendimiento-y-accesibilidad)
- [14. Pruebas](#14-pruebas)
- [15. Fuera de alcance y trabajo futuro](#15-fuera-de-alcance-y-trabajo-futuro)
- [16. Selectores, ranuras y filtros (revisión del propietario, 2026-09-23)](#16-selectores-ranuras-y-filtros-revisión-del-propietario-2026-09-23)

## Cómo leer este documento

- **Lenguaje:** cada frase es un requisito. «Nunca», «solo» y «siempre» son absolutos. No hay recomendaciones opcionales.
- **Fases sin commits:** ninguna fase hace commit, push ni despliegue, ni aplica migraciones de Supabase en remoto. El propietario decide commits y despliegues. Su árbol de trabajo sin commit se conserva.
- **Referencias:**

| Forma | Apunta a |
|---|---|
| `DS:README §Sección` | `README.md` del DS, sección con ese título |
| `DS:guias/NN` | `guias/10-tooltip-del-juego.md`, `20-sprites.md`, `30-tarjetas-y-rejillas.md`, `40-dinero.md`, `50-textos.md` |
| `DS:<Componente>` | `components/<Componente>/README.md` |
| `DS:tokens.<grupo>` | grupo o token de `tokens.json` |
| `Lienzo:<tablero>` | `Main` (Inicio, 1440), `Inicio-movil` (390), `Pokedex`, `Pokedex-Shiny-Charizard` (ficha de Pokémon), `Sistema-Boost` (página de sistema), `Comercio`, `Guild`, `Componentes`, `Tarjetas` |
| `CGS §n` | `docs/design/CARD_GRID_SYSTEM.md` |
| `RUB §n` | `docs/design/RUBINOT_DESIGN_REFERENCE.md` |
| `GAP §n` | `docs/design/GAP_ANALYSIS.md` |
| `v1 §n` | versión 1 de este documento (2026-09-18), en la copia de «Copias locales» |
| `D-0nn` | `docs/DECISION_LOG.md` |
| `archivo:línea` | árbol de trabajo del 2026-09-19, sin commit. `X:25/:32` es la línea de la copia `es` y la de la copia `en` de un mismo archivo |

- **Abreviaturas de archivo:**

| Abrev. | Ruta | Abrev. | Ruta |
|---|---|---|---|
| `AL` | `src/layouts/AppLayout.astro` | `GRID` | `src/components/wiki/PokedexGrid.tsx` |
| `AP` | `src/pages/[locale]/mapa/aportar.astro` | `GRT` | `src/components/tools/GuildRankingTool.tsx` |
| `AW` | `src/components/wiki/AllianceWordmark.astro` | `GS` | `src/lib/supabase/guilds.ts` |
| `BUS` | `src/pages/[locale]/buscar/index.astro` | `GUI` | `src/pages/[locale]/guias/index.astro` |
| `CAM` | `src/pages/[locale]/cambios/index.astro` | `GWC` | `src/components/tools/guild/GuildWorkspaceChrome.tsx` |
| `CFG` | `src/i18n/config.ts` | `HOME` | `src/pages/[locale]/index.astro` |
| `CM` | `src/lib/map/client-map.ts` | `IDX` | `src/pages/[locale]/pokedex/index.astro` |
| `COM` | `src/pages/[locale]/comercio/index.astro` | `IMG` | `src/lib/tools/guild-ranking-image.ts` |
| `CS` | `src/components/wiki/ContentSearch.tsx` | `ME` | `src/components/map/MapExplorer.tsx` |
| `DET` | `src/pages/[locale]/pokedex/[slug].astro` | `MI` | `src/pages/[locale]/mapa/index.astro` |
| `DR` | `src/lib/trade/draft.ts` | `OUT` | `src/components/wiki/OutfitPreview.tsx` |
| `EXP` | `src/components/tools/PokemonExplorer.tsx` | `REG` | `src/lib/content/registry.ts` |
| `FMT` | `src/lib/content/format.ts` | `REPO` | `src/lib/content/repository.ts` |
| `GA` | `src/pages/[locale]/herramientas/guild.astro` | `ROOT` | `src/pages/index.astro` |
| `GPP` | `src/components/tools/GuildPersistencePanel.tsx` | `ROS` | `src/lib/tools/pokemon-roster.ts` |
| `GR` | `src/lib/tools/guild-ranking.ts` | `ROT` | `src/pages/[locale]/rotaciones/index.astro` |
| `SIS` | `src/pages/[locale]/sistemas/index.astro` | `TI` | `src/pages/[locale]/herramientas/index.astro` |
| `SSS` | `src/components/phase3/ServerSaveStatus.tsx` | `TPK` | `src/pages/[locale]/herramientas/pokemon.astro` |
| `TD` | `src/components/trade/TradeDesk.tsx` | `WS` | `src/components/wiki/WikiSearch.tsx` |
| `w:` | `src/styles/wiki-reference.css` | | |

- **Copias locales para medir** (temporales, en el scratchpad de la sesión `ad16e56a-…`):
  - Lienzo: `…/scratchpad/design/canvas-v2/project/<tablero>.dc.html`; estilos exactos de cada pieza compartida: `…/canvas-v2/gen/common.py`.
  - DS: `…/scratchpad/design/ds/project/`.
  - Render y medida de un tablero: `node …/scratchpad/design/render/render.mjs <tablero> [--state JSON] [--out png] [--measure json] [--selector css] [--scale 2]`. Renders por defecto: `…/render/after/*.png`.
  - v1 de esta especificación: `…/scratchpad/design/spec-v1/CORTE_0_CODEX_TOOLTIP_SPEC.v1.md`.
  - Ruta completa de `…`: `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d`.
- **Identificadores:**
  - Decisiones (§1): P1–P4, A1–A22, Q1–Q5 y T1–T33 vienen de v1 §1; R1–R18 son decisiones posteriores a v1; X1–X13, discrepancias del lienzo; E1–E18, decisiones de esta especificación; Q6–Q16, preguntas abiertas; D-B1–D-B7, decisiones que bloquean solo la fase B de Comercio (§9.13). `D-0nn`, con tres cifras, son entradas de `docs/DECISION_LOG.md`.
  - Fases: F0–F5 (§0); qué criterio de §2 exige cada fase: tabla «Criterios por fase» de §2.
  - Objetivos y criterios: O1–O6 y S1–S22 (§2); V3-1–V6-5 (§3–§6); C-R1–C-R7, DP1–DP6 y C7-01–C7-15 (§7); WG, WA, WL, WD y los criterios de página IN, PX, FI, SI, IT, BU, CA, TL, AV, HT, MP, NF, RZ y CP (§8); CA-9.x, CA-10.x y CA-11.x (§9–§11).
  - Comportamiento: TT1–TT13, eventos del controlador de tooltips (§7.5.4); U1–U6, H1–H7, V1–V8 y PR1–PR5, reglas del controlador de listas (§7.7).
  - Barrido (§12): G1–G14, reglas generales; filas con prefijo de área y dos cifras con guion (S-01, H-04, D-09…), distintas de S1, H1 o D-009; PZ-01–PZ-11, piezas de los tableros; DV1–DV9, desviaciones de las pruebas visuales (§14.5).
- **Términos:**
  - **Entidad del juego:** Pokémon, ítem (balls, stones y held items incluidos), sistema, elemento o moneda (Pokédólares, Diamonds), como en `DS:NestedEntity`.
  - **Tooltip del juego:** el `GameTooltip` que abre un `NestedEntity` (`DS:guias/10`).
  - **Registro:** JSON que el propietario edita a mano en `content/` o `public/sprites/sprites.json` (D-011).
  - **Marco:** cabecera, barra lateral, columna principal, rail y pie (`DS:README §El marco`).

---

## 0. Resumen

**Qué se construye.** Toda la interfaz pública se rehace sobre el diseño aprobado el 2026-09-19:
- Marco de wiki fiel a RubinOT: Verdana del sistema, tres grises, cabecera de 64, barra lateral de 208, columna de 944 u 896, rail «Resumen» de 256 y pie de una línea. El contenido y los sprites son de PokeAlliance.
- Una sola capa de juego, el tooltip del juego (panel grafito, etiquetas doradas, Poppins), en cada mención de una entidad.
- Vistas Cards, Slots y Lista en toda lista de entidades, sobre rejillas de anatomía fija.
- Pokédólares con su sprite antes de cada importe.

Los tokens y componentes del DS sustituyen a los cinco CSS actuales (`src/styles/{global,wiki-reference,home,trade,guides}.css`, 10.151 líneas).

**Orden.** Cada fase cierra con los criterios de §2 que le asigna la tabla «Criterios por fase» de §2, medidos sobre las rutas que esa fase y las anteriores ya migraron, y con sus pruebas de §14, antes de empezar la siguiente:
1. **F0 Base** (§3–§6): tokens, capas CSS, fuentes, adaptador de sprites y lectura de registros.
2. **F1 Componentes** (§7): marco, `Sprite`, `GameTooltip` y `NestedEntity`, tarjetas y rejillas, `SlotsPanel`, `DataTable`, `ViewToggle` e importes. Cierra con el prototipo medido de la Pokédex (§13.6).
3. **F2 Wiki** (§8): Inicio, Pokédex (índice y ficha), páginas de sistema, Buscar, Cambios, las demás rutas de la wiki, 404, el marcador de Mapa y el marcador de Comparar Pokémon (§8.14, E18).
4. **F3 Comercio** (§9) y **F4 Guild** (§10).
5. **En cada página migrada:** el barrido de §12 y los requisitos de §13.
6. **Cierre del corte**, al terminar F4: ninguna ruta importa `AppLayout`; se borran los cinco CSS (§3.10 paso 4, S18) y se reescribe la documentación de diseño (S20). Todos los criterios de §2 pasan sobre todas las rutas, Comparar incluido como marcador.
7. **F5 Comparar Pokémon** (§11) empieza cuando el propietario apruebe su tablero (R15) y no bloquea el cierre. Al terminar, el marcador de §8.14 cede a la herramienta y los criterios de §2 se repiten sobre esa ruta.

**Qué no incluye** (§15): el mapa interactivo, las actualizaciones automáticas (changelog del launcher, `/api/mundos`, historial de población), la pasarela de pago, los anuncios promocionados, un tema claro y la aplicación de migraciones de Supabase en remoto.

---

## 1. Decisiones

### 1.1 Precedencia

Si dos fuentes chocan, manda la primera de esta lista:

1. La decisión explícita más reciente del propietario: este §1 y D-009 a D-013.
2. El DS: `tokens.json` para valores, `guias/*.md` y `README.md` para reglas, `components/*/README.md` para cada componente. Si dos documentos del DS chocan, manda la guía.
3. El lienzo v5: geometría y composición de cada página.
4. `CGS`.
5. `RUB`, solo donde el DS no dice nada.
6. v1, solo en lo que §1.2 y §1.4 declaran vigente.

Un texto o una cifra de un tablero es una muestra, no un dato (X4). Si un tablero contradice una decisión del propietario, manda la decisión (§1.5).

Dentro de este documento:
- §8–§11 fijan la estructura de cada página y herramienta; §12 fija el texto de lo que esa estructura conserva. Una fila de §12 cuyo control o sección retiran §8–§11 se cierra borrando.
- En las superficies que §9, §10 y §11 rehacen, manda el texto de esa sección; §12 dice lo que no puede reaparecer y da los mensajes que esa sección no fija.
- §7.7 es el único controlador de listas; §8 y §9 solo configuran cada lista (`ListConfig`).

### 1.2 Decisiones de v1 del propietario (P1–P4, A1–A22, Q1–Q5)

| ID | Decisión (2026-09-18) | Consecuencia en v2 | § |
|---|---|---|---|
| P1 | Adoptar «Codex Tooltip». | La reemplaza R1. | §3–§7 |
| P2 | Capa de juego en toda la wiki, de forma gradual. | La reemplaza R2: la capa de juego es solo el tooltip y la ficha del Pokémon. | §7 |
| P3 | Corte 0 antes que la funcionalidad de Comercio. | Vigente como orden: F0–F2 antes de F3. | §0 |
| P4 | Regla permanente contra el relleno. | Vigente: R12. | §12 |
| A1 | Aprobado: retirar `mapa/aportar/`. Vuelve con el mapa interactivo. | Se borra `src/pages/[locale]/mapa/aportar.astro` y la entrada «Aportar al mapa» (hoy en `src/layouts/AppLayout.astro:74-79`, y también en el lienzo, X1). `/{locale}/mapa/aportar/` redirige con 302 a `/{locale}/mapa/`. | §8, §12 |
| A2 | Rechazado: Cambios se queda. | `/{locale}/cambios/` sigue en el menú (grupo Comunidad, `Lienzo:Main`) e indexable. Su contenido sale de un registro editado a mano (§8). Sin entradas muestra un estado vacío de una línea. | §8 |
| A3 | Inicio como el de RubinOT, con sprites del juego como iconos. | Inicio = `Lienzo:Main` a 1440 y `Lienzo:Inicio-movil` a 390. Lleva `HomeIntro` (sprite de 48, h1 y una línea con cifras de los registros), `SearchTrigger` con Ctrl + K, «Destacados» (4 `FeaturedCard`), `IndexPanel` con conteos reales y `WorldsTable` (X3). La cabecera del Inicio no lleva buscador. | §8 |
| A4 | A criterio del equipo. | El menú del lienzo: Inicio, Destacados (único grupo con sprites, de 16), Pokémon, Sistemas, Ítems, Actividades, Herramientas y Comunidad, sin «Aportar al mapa» (A1). Los iconos lucide de T19 no se usan (R11). §8.0.3 fija los enlaces de cada grupo. | §7, §8 |
| A5 | Aprobado: pie con aviso de no afiliación. | `Footer` en todas las páginas, Inicio incluido: «Alliance Codex es un proyecto comunitario independiente, no afiliado a PokeAlliance.» / «Alliance Codex is an independent community project, not affiliated with PokeAlliance.» | §7 |
| A6 | Pendiente en v1. | Sin objeto: los 7 archivos huérfanos de T21, `src/components/ui/card.tsx` y `src/components/ui/separator.tsx` ya están borrados en el árbol de trabajo (`git status`: `D`). Ninguna fase los recrea. | — |
| A7 | Aprobado: «items» en lugar de «Objetos». | «Objetos» desaparece de la interfaz `es`. Se escribe como en el lienzo: «ítems» / «Ítems» en la wiki (búsqueda, Inicio, menú) e «Items» solo como tipo de activo de Comercio (X6). «Misiones» cede al vocabulario del lienzo («Actividades», «Quests principales»). | §12, §13 |
| A8 | Aprobado: números `es-MX`. | Lo reemplaza el DS, aprobado después (`DS:guias/40`, `DS:guias/50`). En `es`, miles con punto y decimales con coma, también con cuatro cifras: «1.800», «57.960», «2,5k», «−8,4%». `Intl` necesita `useGrouping: 'always'`, porque `es-ES` deja «1800» sin agrupar (comprobado en Node 22.16). En `en`, formato `en-US`: «1,800», «2.5k». Excepción: la valoración (X5). | §13 |
| A9 | Rechazado: el aura Premier está verificada (Q4). | La ficha ofrece Aura: Ninguna, Alliance y Premier (`Lienzo:Pokedex-Shiny-Charizard`), con datos de `content/auras.json`. Ningún texto de «prueba» ni de «hipótesis». | §8 |
| A10 | A criterio del equipo. | «Ver JSON» desaparece de Guild. Las salidas son «Exportar PNG» y «Exportar CSV» (`Lienzo:Guild`). | §10 |
| A11 | Pendiente hasta el mapa interactivo. | Fuera del corte (R9). | §15 |
| A12 | A criterio del equipo. | Guild no tiene selector de zona horaria. Días y semanas se cortan con el Server Save de las 00:00 en hora de Brasilia (`America/Sao_Paulo`), y las horas se escriben con «(hora de Brasilia)» (`Lienzo:Guild`). | §10 |
| A13 | Aprobado, con Comparar rehecho por completo. | Ver R15. | §11 |
| A14 | A criterio del equipo. | Guardar y Cancelar de la edición de metas cubren todo lo que edita el formulario. No hay texto «Sin cambios». §10 decide dónde se editan las metas. | §10 |
| A15 | Aprobado: aviso de RMT. | El aviso de v1 lo sustituye el `InfoBanner` de `Lienzo:Comercio`: «Alliance Codex no procesa pagos \| El comprador contacta al vendedor por sus canales verificados \| Reseñas de 0 a 5, solo de operaciones confirmadas por ambas partes». Solo se muestra con la fase B activa o con anuncios en el conjunto (E6). | §9 |
| A16 | A criterio del equipo. | En los formularios de Comercio: validar tras la primera interacción, asociar cada error a su campo y, al enviar con errores, llevar el foco al primero (WCAG 3.3.1 y 4.1.3). | §9, §13 |
| A17 | Aprobado: cuenta regresiva del Server Save y «Copiar coordenadas». | «Copiar coordenadas» llega con el mapa (R9). La cuenta regresiva no está en el lienzo (X7, Q7). Mientras Q7 no tenga respuesta, no se muestra y `ServerSaveStatus` sale del Inicio (hoy en `src/pages/[locale]/index.astro:158`). | §8 |
| A18 | Sustituir los datos de muestra por información real. | Las páginas leen solo registros (R7). No queda texto de muestra ni registros de investigación. Un registro de relleno lleva `"borrador": true`. | §8 |
| A19 | Tres vistas y tooltip del juego en toda mención. | Ver R2 y R3. | §7 |
| A20 | Arreglar todo lo que se ve mal o falla. Usar el Diamond real y un registro de sprites. | El registro de sprites ya existe (D-011). Los fallos de `GAP §6` (1–14) se cierran en las páginas que siguen existiendo; los de rutas retiradas desaparecen con ellas. | §12 |
| A21 | Tokens y componentes con personalidad propia, sin exagerar. | Resuelto por el DS. La personalidad se limita a la lista de `DS:README §Principios`: tooltip en cada mención, selección ámbar con anillo de 2 px, Diamond que gira, rebote de 3 px de los sprites en Destacados y en el menú, y formato de dinero de los jugadores. Nada más añade decoración. | §7 |
| A22 | Aprobado: quitar el atajo «/». | Se borran el listener de `src/components/wiki/PokedexGrid.tsx:102-117` y el `<kbd>/</kbd>` de `:196`. El único atajo global es Ctrl + K (búsqueda). | §8, §13 |
| Q1 | El piso 7 es la superficie; los pisos inferiores suben de número y los superiores bajan. | Solo para el corte del mapa (R9). | §15 |
| Q2 | El export se hace desde la ventana de guild del juego (Ctrl+J). | Junto a «Importar export»: «Exporta desde la ventana de guild del juego (Ctrl+J).» (`Lienzo:Guild`). | §10 |
| Q3 | Los NPC conservan su nombre. | «Fisherman» y «Dr. Vektor» sin traducir en ambos idiomas y sin atributo `lang`. | §13 |
| Q4 | El aura Premier coincide con el juego. | Ver A9. | §8 |
| Q5 | `level` es el nivel requerido; el cliente muestra «NIVEL 40». | Etiqueta «Requisito» con valor «Nivel N» en tarjetas y Lista, y «Requisito: Nivel 120» en el tooltip (`DS:guias/50`). En `en`: «Requirement» y «Requirement: Level 120» (§13.3). | §8, §13 |

### 1.3 Decisiones posteriores a v1 (R1–R18)

| ID | Decisión | Consecuencia para la implementación | § |
|---|---|---|---|
| R1 | Fidelidad a RubinOT (corrección del propietario del 2026-09-18). El propietario rechazó tres direcciones propias: el tooltip del juego en todo el sitio, la Pokédex «dispositivo» roja y el navy/bronce ornamentado. | Marco y componentes siguen el lenguaje medido de RubinOT (`RUB`) tal como lo fija el DS: Verdana del sistema en 400 y 700, grises `bg-primary` `#0c0e12`, `bg-secondary` `#13161b` y `bg-tertiary` `#22262f`, bordes de 1 px y un solo hover (`bg-tertiary`). Sin sombras de elevación, degradados ni brillo. Nunca se usan la marca, los textos ni las imágenes de RubinOT. | §3–§7 |
| R2 | El tooltip del juego es solo para entidades del juego. | Poppins, el oro y los tokens `tt-*` viven solo dentro de `GameTooltip`: el tooltip, la ficha fija del Pokémon (§8.3) y la ficha del anuncio (§9.6), que describe el Pokémon o el ítem en venta. Excepciones: la marca `tt-shiny` en tarjetas, slots y chips; el tooltip compacto del gráfico de Guild, que `DS:BarChart` dibuja con `tt-panel` y Poppins aunque sus cifras no son una entidad (pendiente de confirmar, Q14). Toda mención de una entidad es un `NestedEntity`: abre con hover, foco y toque, Shift la fija, Escape la cierra y como máximo hay un tooltip sin fijar y uno fijado (TT9; WCAG 1.4.13; `DS:guias/10`). Una mención sin registro de entidad no se enlaza ni abre tooltip. | §7, §8 |
| R3 | Tres vistas (A19, precisada en el lienzo). | Toda lista de entidades del juego (Pokédex, drops, ítems, anuncios de Comercio, resultados de búsqueda de entidades) lleva `ViewToggle` con Cards, Slots y Lista. En Cards la tarjeta no abre tooltip y sus entidades anidadas sí. En Slots y Lista lo abren el slot y el nombre. La vista elegida se recuerda por lista y por visitante en el almacenamiento del navegador, con lecturas y escrituras en `try/catch`; si falla, la vista es la por defecto de la lista: Cards, salvo la Tier list de la ficha (E15). | §7, §8, §9 |
| R4 | Sistema de tarjetas (2026-09-19, tras la queja por rejillas desiguales). | Se aplican `CGS` y `DS:guias/30`: una familia por rejilla; anatomía fija sobre subgrid; `align-items: stretch`; columnas por familia; claves = unión del resultado, con «—» donde falta un valor; Comercio «Todos» agrupado por tipo (Pokémon, Items, Diamonds, Pokédólares); paginación antes de agrupar. Nunca masonry, `grid-auto-flow: dense`, `order` ni colocación explícita. | §7 |
| R5 | Pokédólares (D-013). | El dinero del juego se llama «Pokédólares» / «Pokédollars» y usa el formato k/kk de `DS:guias/40`. Su sprite (`ui/pokedolares`, 32 px) va antes de cada importe del juego y nunca en una mención sin importe. El lector de pantalla oye la cifra exacta. «KKs», «KK» y «gold» no aparecen en la interfaz. Diamonds lleva su sprite y, dentro de un precio, abre su tooltip. Las cantidades se guardan como enteros en unidades base. | §7, §9 |
| R6 | Sin procedencia (D-012). | Ningún dato, pantalla, esquema, script ni tabla guarda o muestra fuentes, evidencias, estados de verificación de datos, fechas de obtención ni hashes de procedencia. «Contacto verificado» de Comercio es una función del producto, no procedencia. Guild muestra la fecha del corte, no el nombre del archivo. | §8, §12 |
| R7 | Registros editables por el propietario (D-011). | El sitio lee `content/*.json` y `public/sprites/sprites.json`. Los componentes del DS reciben URLs y fotogramas; un adaptador del sitio resuelve la clave del registro (§3.12, §7.4). `null` se muestra como «—» donde otras filas tienen valor y se omite en el tooltip (X13). `"borrador": true` se muestra, salvo en un build con `OCULTAR_BORRADORES=1`. Los registros de Comercio de la fase A tienen su propio interruptor, `COMERCIO_DEMO` (§9.2). Toda cifra del sitio, conteos del Inicio incluidos, sale de los registros. Todo registro nuevo lleva esquema en `content/schemas/` y pasa por `pnpm content:check`. | §3–§6, §8 |
| R8 | A6 sin objeto. | Ver A6. | — |
| R9 | El mapa llega después (A11). | `/{locale}/mapa/` es un marcador: marco, migas, título y un estado vacío de una línea (§8). `MapExplorer` deja de renderizarse (hoy en `src/pages/[locale]/mapa/index.astro:56`). Su código y `content/map/*` se conservan para el corte del mapa, junto con A1, Q1 y «Copiar coordenadas». | §8, §15 |
| R10 | Actualizaciones automáticas solo a futuro. | No se construyen la Action del changelog del launcher, `/api/mundos` (caché de 5 minutos) ni el historial de población en Supabase. Cambios y la lista de mundos se rellenan a mano (X3). | §15 |
| R11 | Sprites del juego como iconografía (A3, `DS:guias/20`). | Navegación y entidades solo con sprites del registro. Los SVG de trazo solo para los glifos utilitarios de `DS:README §Iconografía`. Sprites de píxel con `image-rendering: pixelated` a escala entera, en una celda de 32. El arte de Pokémon y los iconos de elemento escalan en suave. La única reducción es el Diamond del menú, a 0,5x. Una entidad sin sprite muestra la marca de sprite faltante, nunca un icono genérico. | §7 |
| R12 | Sin relleno (P4, regla permanente de D-010). | Sin texto decorativo, meta, de proceso ni que explique el diseño; sin relleno, sin emoji, sin controles falsos, sin cifras inventadas. Los textos y cifras de los tableros son muestras (X4). §12 lleva el inventario y la lista prohibida. | §12 |
| R13 | Comercio es RMT con contacto verificable (D-009, D-007 y `docs/TRADE_PRODUCT_PLAN.md`). | Precio en dinero real (R$, US$, MX$), en el juego (Pokédólares, Diamonds) o ambos, sin conversión. Publicar, iniciar un contacto de compra y reseñar exige una cuenta con correo y teléfono verificados. La cuenta es la del flujo general que también usa Guild, y el requisito se impone en servidor y base de datos, no solo en la interfaz. Canales verificados: correo, teléfono con código de país completo, Discord, Twitch y otros. En tarjetas y tooltips el teléfono aparece solo como «Teléfono +55»; §9 define cuándo y a quién se revela un contacto. Reseñas enteras de 0 a 5, cada una ligada a una operación que confirman comprador y vendedor. Sin pasarela de pago. Los anuncios promocionados futuros llevarán etiqueta y no cambiarán el orden por valoración. Las migraciones son solo locales. El lanzamiento público espera el gate de D-007 y D-009 (términos, RLS, moderación y aceptación del propietario). | §9 |
| R14 | Guild con analítica de administración: día, semana, tendencias e inactividad. | La herramienta sigue `Lienzo:Guild`: periodo (Hoy, 7 días, 30 días, Rango), KPI, «Por día» (14 días con meta diaria), «Por semana» y miembros con tendencia de 14 días y filtro de inactivos. Siguen vigentes D-004 (identidad por el nombre del juego) y D-005 (puntos de cada daily según el nivel: 150 de 0 a 149, 300 de 150 a 349 y 600 desde 350). | §10 |
| R15 | Comparar Pokémon se rehace desde cero (A13). | El lienzo no tiene tablero de Comparar. §11 especifica la herramienta solo con componentes del DS; F5 empieza cuando el propietario apruebe su tablero. Hasta entonces la ruta es un marcador (§8.14, E18). La pestaña «Explorar tiers» desaparece: los tiers viven en la página «Tier list» del menú (`Lienzo:Main`). | §11 |
| R16 | Primero el diseño (v1 §1.5). El lienzo y el DS se aprobaron el 2026-09-19. | Una página sin tablero se compone solo con plantillas y componentes del DS; §8 le asigna su plantilla. Una herramienta que cambia de funcionamiento necesita tablero aprobado (R15). Ningún componente usa valores fuera de `tokens.json`. Un token nuevo se añade a la vez a `tokens.json` del DS y a `src/design/tokens.json` (§3.2, §3.3, E14). | §3–§8 |
| R17 | Dependencias externas y componentes de la comunidad autorizados (v1 §1.5). | Se admiten si resuelven un requisito, por ejemplo la posición del tooltip o la paleta de búsqueda. §3.8 lista cada dependencia nueva con su motivo y su peso (E8). lucide queda solo para glifos utilitarios (R11) y `tw-animate-css` sale (T24). | §3–§6 |
| R18 | Outfits del juego (D-008, D-011). | La ficha muestra el outfit idle (fase 0 del `.dat`) y el aura elegida. Nunca un frame de caminar. | §8 |

### 1.4 Decisiones técnicas de v1 (T1–T33)

| ID | Estado | En v2 |
|---|---|---|
| T1 | Vigente | Tema único «Oscuro» (`DS:tokens.color.themes`): `<html class="dark">` y `color-scheme: dark`. No hay botón de tema (X2). |
| T2 | Vigente, ampliada | Salen los indicadores `PanelLeft` y `Moon`, que son `aria-hidden` y no hacen nada (`src/layouts/AppLayout.astro:143-158`). El selector de idioma pasa a ser un control real con su listado (`DS:Header`), así que conserva el chevron. |
| T3 | Modificada | Verdana del sistema, sin autoalojar. Poppins 500 y 600 es la única fuente web, solo para el tooltip y la ficha, y se autoaloja: 0 peticiones a Google Fonts en ejecución (X8). Inter sale. |
| T4 | Vigente; sin view transitions | Navegación entre documentos, sin `<ClientRouter />`. El DS no define transiciones de página, así que las view transitions de v1 §7 no se implementan y las actuales se borran (§6.1). |
| T5 | Modificada | La fuente de tokens es `DS:tokens.json` con sus nombres (`bg-primary`, `space-16`, `radius-12`…). Los prefijos `--cx-*`, `--wiki-*` y `--trade-*` desaparecen. Archivos y generación: §3.2–§3.5. |
| T6 | Vigente | Todo el CSS de componentes va en capas, con 0 `!important`. §3.6 fija el orden de las capas. |
| T7 | Reemplazada | Radios de `DS:tokens.radius` (2, 3, 4, 6, 8, 10, 11, 12 y full), con los papeles de `DS:README §Espacio, radios y estados`. Los botones nunca son píldoras. |
| T8 | Reemplazada | `layout-bp-md` 768 y `layout-bp-xl` 1280. Barra lateral y rail desde 1280; por debajo, hoja móvil de 288 y márgenes de 16. Rail «Resumen» de 256 en páginas con secciones; espaciador de 208 en páginas sin rail. Anchos por página: `CGS §3`. |
| T9 | Reemplazada | Selección ámbar: borde de 1 px `selected` más `ring-selected` (2 px en total) y fondo transparente. Foco: `outline` de 2 px en `ring` con 1 px de separación en todo lo enfocable. El ámbar nunca marca un enlace. |
| T10 | Reemplazada | Toggles y conmutadores son botones con `aria-pressed` (`DS:README §Accesibilidad`, `DS:ToggleGroup`, `DS:ViewToggle`). |
| T11 | Reemplazada | Verdana con `tabular-nums` en tablas, conteos, precios, KPI y pilas. Formato de números: A8. |
| T12 | Vigente | En `es`, «18/09/2026, 14:32» (24 h) y «(hora de Brasilia)» para la hora del servidor. En `en`, «Sep 18, 2026» y 12 h. |
| T13 | Reemplazada | A7. |
| T14 | Reemplazada | Etiquetas del lienzo: «Requisito», «Tier», «Rol», «Variante», «Elementos», «Generación». En el tooltip llevan dos puntos (`DS:guias/10 §Contenido`). |
| T15 | Reemplazada | Migas en toda página interior (`DS:README §El marco`; «Comunidad > Comercio» en `Lienzo:Comercio`). El Inicio, Buscar y 404 no llevan migas (E4). |
| T16 | Vigente, con cambios | Se retira `mapa/aportar/` (A1). La raíz pasa a una redirección 302 de configuración a `/es/`, en lugar de la página prerenderizada de `src/pages/index.astro`. Se añade `src/pages/404.astro`. La galería de componentes no es una ruta pública: los componentes se prueban en las rutas `/_paridad/` del build visual (§14.5). §8.0.1 lista las rutas nuevas. |
| T17 | Reemplazada | A2. |
| T18 | Reemplazada | A3. |
| T19 | Reemplazada | A4 y R11. |
| T20 | Vigente | A5. |
| T21 | Hecha | A6. |
| T22 | Vigente | Las frases en inglés dentro de una página `es` llevan `lang="en"` (`DS:guias/50 §Idiomas`). |
| T23 | Vigente, precisada | Los términos del juego se escriben como en el cliente de cada idioma: Tier, Held Items, Memory Slots, Star Level, Boost, NPC Price, PVE, PVP, T3, Legendary, Shiny. Los elementos se localizan como en el lienzo («Fuego», «Volador»). Nombres propios y términos del juego no llevan `lang`. |
| T24 | Vigente | Sin `tw-animate-css`. Solo se permite el movimiento de `DS:README §Movimiento`. |
| T25 | Reemplazada | El marco no tiene color de marca. Botones con borde `border-primary` y hover `bg-tertiary`. El oro solo existe en el tooltip. |
| T26 | Reemplazada | `DS:tokens.json` es la lista completa de tokens (R16). |
| T27 | Aplazada | R9. |
| T28 | Reemplazada | R15. |
| T29 | Vigente | El arte de Pokémon se enlaza desde `https://wiki.pokealliance.com` (`src/lib/content/pokemon-media.ts:1`), con caja reservada por CSS y escala suave. El espejo del arte queda fuera (§15). |
| T30 | Vigente | `site`, `canonical`, `hreflang` absolutos por página y `x-default` a `es` (§13). Hoy `hreflang` apunta a las raíces (`src/layouts/AppLayout.astro:99-100`). |
| T31 | Condicionada | El cálculo en el cliente del próximo Server Save aplica solo donde se muestre (A17, Q7). |
| T32 | Reemplazada | «—» donde otras filas tienen valor; nunca 0 ni «N/D». En el tooltip, la fila se omite (`DS:guias/50`, `CGS §5.4`). |
| T33 | Vigente, precisada | Llevan dos puntos las etiquetas del tooltip, de `FactLine` y de los datos de `InfoBanner`, y el rótulo de `Note`; las de tarjetas, tablas y filtros no (`DS:guias/50`, `DS:FactLine`). |

### 1.5 Discrepancias del lienzo y cómo se resuelven (X1–X13)

| ID | En el lienzo o el DS | Choca con | Resolución |
|---|---|---|---|
| X1 | «Aportar al mapa» en el grupo Comunidad de todos los tableros. | A1 | No se implementa el enlace. |
| X2 | Botón de tema «Cambiar a tema claro» en la cabecera (`DS:Header`), con un único tema en el DS. | R12: un botón que no cambia nada es un control falso. | El botón y su separador no se renderizan hasta que exista un tema claro (Q6). Desde 1280, la cabecera termina en el selector de idioma; por debajo, en separador y menú. |
| X3 | `WorldsTable` con jugadores en línea (`Lienzo:Main`). | R10 y R12 | La tabla lista los mundos de un registro, solo con la columna «Mundo». La columna «En línea» y su orden llegan con `/api/mundos`. |
| X4 | Cifras y textos de muestra: «910 variantes», conteos de paneles, anuncios, miembros de guild, probabilidades de Boost. | R7 y R12 | Ningún texto ni cifra de un tablero pasa al código. Cada valor se calcula o se lee de un registro o lo aporta el usuario; si falta, se muestra «—» o se omite. |
| X5 | Valoración «4.6» en `es` (`DS:Rating`), con coma decimal en el resto del DS (`DS:guias/40`). | A8 | Se conserva como en el DS: la valoración lleva un decimal con punto en ambos idiomas («4.6», «5.0»). Es la única cifra con punto decimal en `es`. |
| X6 | «Items» en Comercio e «Ítems» en el Inicio y el menú. | A7 | Se conservan las dos: «Items» es el tipo de activo de Comercio (pestaña, grupo y Slots); «ítems» es el sustantivo de la wiki. |
| X7 | La cuenta regresiva del Server Save no aparece en ningún tablero. | A17 | Q7. |
| X8 | `DS:README §Tipografía` carga Poppins desde Google Fonts. | T3 | Poppins se autoaloja. La URL de Google solo sirve al artefacto del DS. |
| X9 | «Acceso: Leader y Vice-Leader» en `Lienzo:Guild`. | R12: los rangos del juego no se pueden comprobar para una cuenta del sitio. | «Acceso» muestra los roles del sitio: «propietario y N oficiales» (§10.4). La prueba visual lo enmascara (DV7). |
| X10 | `Lienzo:Guild` no muestra dónde se editan las metas ni cómo se abre la evaluación de un miembro. | A14 | Se añaden el botón «Metas» junto a «Importar export» y el nombre del miembro como botón que abre su diálogo (§10.5, §10.9). La prueba visual enmascara «Metas» (DV8). |
| X11 | `Lienzo:Pokedex-Shiny-Charizard` no tiene selector de dirección del outfit ni paginador anterior/siguiente (hoy en `src/pages/[locale]/pokedex/[slug].astro:148-174`). | D-008 pedía las cuatro direcciones, con sur por defecto. | Se sigue el tablero: frame idle sur, sin selector de dirección ni paginador (§8.3). Q11 confirma la dirección. |
| X12 | La línea de `HomeIntro` de `Lienzo:Main` y su ejemplo en `DS:guias/50` dicen «guías»; el menú del mismo tablero dice «Actividades». | A7, X4 | La línea nombra las colecciones publicadas con el vocabulario del menú: «ítems», «sistemas» y «actividades» (§8.1). No hay colección de guías hasta §15. Cambia un texto del tablero y del DS aprobados: pendiente de confirmar (Q13); la prueba visual lo enmascara (DV6). |
| X13 | D-011 y D-012 dicen que la interfaz muestra «—» para `null`. El DS aprobado después (`DS:guias/50`, `DS:GameTooltip`, `CGS §5.3–§5.4`) muestra «—» solo donde otras filas del conjunto tienen valor, omite la fila en el tooltip y en la ficha fija, y quita la clave que ninguna fila tiene. | D-011, D-012 (§1.1, punto 1) | El DS precisa D-011 y D-012 sin contradecir su fin (nunca «0» ni «N/D» para lo desconocido): se aplica la regla del DS (T32, §8.0.5). Pendiente de confirmar (Q16); si el propietario pide «—» en toda fila, cambian T32, FI3 y `GameTooltip`. |

### 1.6 Decisiones de esta especificación (E1–E18)

Resuelven lo que el lienzo, el DS y v1 dejan abierto. Cada fila remite a la sección que la desarrolla.

| ID | Decisión | § |
|---|---|---|
| E1 | `/{l}/pokedex/tiers/` es la página «Tier list» del menú (`Lienzo:Main`, grupo Pokémon) y absorbe la pestaña «Explorar tiers» (R15). `/{l}/rotaciones/` redirige ahí con 302. | §8.8 |
| E2 | `/{l}/actividades/` recibe las misiones (A7). `/{l}/guias/` redirige ahí con 302. | §8.9 |
| E3 | La Pokédex no tiene campo de búsqueda propio: el nombre se busca con Ctrl + K. | §8.2 |
| E4 | Buscar y 404 no llevan migas (excepción a T15). | §8.0.4 |
| E5 | En Buscar, los grupos Sistemas, Actividades y Páginas son listas de enlaces iguales en las tres vistas: el DS no tiene familia de tarjeta para ellos (excepción a R3). | §8.6 |
| E6 | Comercio tiene dos fases: A, estática y sin cuentas; B, con Supabase, activada por `COMERCIO_PUBLICO`. Los anuncios y vendedores de la fase A son datos de demostración: solo se leen con `COMERCIO_DEMO=1` (desarrollo, pruebas y build visual), nunca en el build de producción, independientemente de `OCULTAR_BORRADORES`. El `InfoBanner` de A15 solo se muestra con la fase B activa o con anuncios en el conjunto. La intención «Comprar» sale; los anuncios de compra quedan en §15. D-B1–D-B7 bloquean solo el lanzamiento de la fase B. | §9.1, §9.2, §9.5.1, §9.13 |
| E7 | Guild pierde la lista de altas y bajas; el motor sigue calculando la elegibilidad. | §10.14 |
| E8 | `@floating-ui/dom` es la única dependencia nueva de ejecución; no se usa `@floating-ui/react`, porque un solo controlador delegado atiende el HTML del servidor. Salen `@base-ui/react`, `class-variance-authority`, `cn`, `shadcn` y `tw-animate-css`: `Dialog`, `Combobox`, `Checkbox`, `RadioGroup` y `Textarea` se construyen sobre elementos nativos. | §3.8, §7.2.8, §7.5.1 |
| E9 | `Sprite` conserva `<img>` con `object-position` y keyframes generadas en el build. La hoja desplazada del DS escribe sus keyframes en el cliente y faltarían en el HTML prerenderizado. | §7.4.2 |
| E10 | En una ruta hija sin entrada propia en el menú (una ficha), la entrada de su sección lleva `aria-current="true"` con el aspecto de la página actual. | §7.10.2 |
| E11 | La paleta Ctrl + K no tiene tablero: se compone solo con piezas y tokens del DS (R16). | §7.9.3 |
| E12 | En pantalla, la forma corta de los Pokédólares redondea a un decimal (`DS:guias/40`) y el lector de pantalla oye la cifra exacta. La forma «solo si es exacta» de `src/lib/trade/draft.ts:22-26` queda solo para el texto copiado de Comercio, que no tiene cifra accesible. | §4.3, §9.7.7 |
| E13 | Los rangos de guild se escriben con los términos del cliente, iguales en los dos idiomas: Leader, Vice-Leader, Member. | §10.9, §13.4 |
| E14 | Tokens nuevos: grupo `motion` (5 duraciones y 3 curvas), `z-header` y `layout-main-max`. Entran también en `tokens.json` del DS (R16). | §3.3 |
| E15 | La sección «Tier list» de la ficha es una lista de entidades con las tres vistas (R3). Su vista por defecto es Lista, que es la tabla de `Lienzo:Pokedex-Shiny-Charizard`; Cards y Slots se eligen con su `ViewToggle`. | §7.7.1, §8.3 |
| E16 | Los ítems de sistema (`content/system-items.json`) son entidades del juego: tienen tooltip (`systemItemTip`), entrada en Buscar y, en su página de sistema, una lista con las tres vistas. | §7.5.3, §8.4.2, §8.6 |
| E17 | El bento del Inicio es una rejilla de maquetación, no una rejilla de tarjetas: coloca sus cinco paneles con `grid-template-areas` según el ancho de su contenedor (3, 2 o 1 columnas, `CGS §6.5`). Su DOM sigue el orden de una columna. Las prohibiciones de `order` y de colocación explícita de R4 y §7.6.5 valen para las rejillas de tarjetas. | §7.6.5, §8.1 |
| E18 | Desde F2 y hasta que termine F5, `/{l}/herramientas/pokemon/` es un marcador con la plantilla E: la herramienta actual sale con «Explorar tiers» y la nueva espera su tablero (R15). Así el corte cierra sin F5. | §0, §8.14 |

### 1.7 Preguntas abiertas al propietario (no bloquean)

D-B1–D-B7 (§9.13) no están aquí: bloquean el lanzamiento de la fase B de Comercio.

| ID | Pregunta | Qué cambia con la respuesta | Mientras no responda |
|---|---|---|---|
| Q6 | ¿Quiere un tema claro? | Tokens claros en el DS y botón de tema real (`DS:Header`). | Sin botón de tema (X2). |
| Q7 | ¿Dónde va la cuenta regresiva del Server Save (A17)? El lienzo aprobado no la incluye. | La página y el lugar de `ServerSaveStatus` y su prueba. | No se muestra; sale del Inicio. |
| Q8 | ¿Cuál es el tier máximo de un held item? | El tope del campo «Tier» de Comercio. | `HELD_TIER_MAX = 99`, un límite del campo y no un dato del juego (§9.4). |
| Q9 | ¿Qué monedas reales admite Comercio? | La constante de monedas de `src/lib/trade/types.ts` y el filtro «Moneda». | R$, US$ y MX$ (§9.4, §9.7.4). |
| Q10 | ¿Se sube el contraste de dos tokens del DS: `ring` a `#5b64f0` (3,91 / 3,26 / 3,31 sobre `bg-secondary`, `bg-tertiary` y `tt-panel`) y `text-quaternary` a `#8a8d93` (4,55 sobre `bg-tertiary`)? | Dos valores de `tokens.json` y la declaración de conformidad. | Valores aprobados; el sitio se declara «WCAG 2.2 AA salvo 2 excepciones de contraste documentadas» (§13.7). |
| Q11 | ¿La ficha ofrece las cuatro direcciones del outfit (D-008) aunque el tablero no tenga selector? | Un `ToggleGroup` de dirección en la ficha. | Sin selector; frame idle sur (X11). |
| Q12 | ¿`precioNpc.vende` es lo que paga el NPC y `precioNpc.compra` lo que cobra la tienda? | Las etiquetas de las dos filas de precio del ítem. | «Precio NPC» / «NPC Price» para `vende` y «Precio de tienda» / «Shop price» para `compra` (§8.5). |
| Q13 | ¿La línea del Inicio nombra «actividades», como el menú, en lugar de «guías», como `Lienzo:Main` y `DS:guias/50` (X12)? | El texto de la línea de `HomeIntro` y la máscara DV6. | «actividades» (X12). |
| Q14 | ¿El tooltip compacto del gráfico de Guild conserva el aspecto del tooltip del juego (`tt-panel`, Poppins, oro), como en `DS:BarChart`, aunque sus cifras no son una entidad del juego? | Si no: panel `bg-tertiary`, borde `border-primary`, radio 8 y Verdana `ui`, como el popover «+N» (§7.5.8), y la excepción de R2 desaparece. | Como `DS:BarChart` (R2, §3.9). |
| Q15 | ¿`contribution` del export de guild es un importe de Pokédólares? `docs/GUILD_SYSTEM_RESEARCH.md:45` lo llama «contribution money» y la interfaz actual lo llamaba «Donación». | Si sí: cada importe de contribución (KPI, gráfico, tooltip del día, tablas, diálogo del miembro y PNG) es un `PokedolaresAmount` con sprite y forma k/kk (R5); el CSV conserva la cifra exacta sin agrupar. | Entero agrupado sin sprite (§10.6–§10.12). |
| Q16 | ¿Acepta la regla de desconocidos del DS (X13): «—» solo donde otras filas tienen valor, la fila se omite en el tooltip y la clave que nadie tiene desaparece? | Si pide «—» en toda fila: T32, FI3, `GameTooltip` y las pruebas de §7.5.3. | Regla del DS (X13). |

---

## 2. Objetivos y criterios de salida

**Objetivos**

- O1. **Fidelidad:** cada página con tablero coincide con él en geometría y composición; las demás usan solo plantillas y componentes del DS.
- O2. **Lenguaje de juego:** toda entidad mencionada abre su tooltip, toda lista de entidades ofrece tres vistas y toda la iconografía es de sprites reales.
- O3. **Contenido limpio:** cero relleno, controles falsos, cifras inventadas y procedencia.
- O4. **Accesibilidad:** WCAG 2.2 AA, salvo los pares de contraste que el DS anota como excepción.
- O5. **Estabilidad y rendimiento:** sin saltos de maquetación por fuentes o imágenes y con el CSS compartido a la mitad o menos.
- O6. **Mantenibilidad:** una fuente de tokens y datos solo en registros.

**Criterios de salida.** Todos son obligatorios. «Todas las rutas» significa el inventario de §8–§11 en `es` y en `en`. §14 asigna al menos una prueba automática a cada criterio, salvo los marcados «revisión».

| # | Criterio | Medida y umbral | Verificación |
|---|---|---|---|
| S1 | Marco | A 1440 × 900, en todas las rutas: cabecera de 64 de alto; barra lateral de x 0 a 208; columna principal desde x 248 con 944 de ancho sin rail, o con 896 y el rail en x 1184 con 256 de ancho. Tolerancia ±1 px. Si la ruta tiene entrada en el menú, esa entrada lleva `aria-current="page"` y fondo `bg-tertiary`; en una ruta hija sin entrada propia (ficha, detalle o perfil de Comercio), la entrada de su sección lleva `aria-current="true"` con el mismo aspecto (E10); Buscar, 404 y Cuenta no marcan ninguna. A 1280, 1024 y 768, los anchos de `CGS §3`. A 390, sin barra lateral, márgenes de 16 y 0 desbordamiento horizontal. | §14 |
| S2 | Rejillas | En cada rejilla de tarjetas de todas las rutas, a 1440, 1280, 1024, 768 y 390: columnas y anchos de `DS:guias/30 §Responsive`. Por fila, dispersión de alturas = 0 y dispersión del inicio de cada zona = 0 (±0,5 px). Con las sobrescrituras de WCAG 1.4.12: 0 textos fuera de su tarjeta y 0 filas de hechos solapadas. | §14 |
| S3 | Tooltip | Cada `NestedEntity` tiene `aria-describedby` hacia un `role="tooltip"`. Abre con hover, con foco y con el primer toque, y sigue abierto con el puntero encima. Escape lo cierra, también fijado. Un Shift solo (menos de 400 ms, sin otra tecla, con el foco fuera de un campo de texto) lo fija y lo suelta; Shift+Tab y Shift+clic no fijan. Como máximo hay abiertos un tooltip sin fijar y uno fijado; fijar uno suelta y cierra el que estaba fijado (TT9). Ningún `article` de tarjeta es disparador. El panel queda dentro de la ventana a 8 px del borde (16 en teléfono) y, si no cabe en alto, se desplaza por dentro (§7.5.5). | §14 |
| S4 | Tres vistas | Cada lista de entidades del inventario de §8–§11 tiene `ViewToggle` con Cards, Slots y Lista. En cada página de resultados las tres vistas muestran el mismo conjunto, y dos elementos del mismo grupo aparecen en el mismo orden relativo en las tres (una vista que agrupa y otra que no, como Comercio «Todos» o las Slots de la Pokédex, cumplen así). La vista elegida sobrevive a una recarga. | §14 |
| S5 | Tipografía | `body` calcula la pila Verdana de `font-sans`. Poppins solo se calcula dentro de `[role="tooltip"]`, de las fichas fijas (Pokémon y anuncio) y del tooltip del gráfico de Guild (R2); la monoespaciada, solo en el `kbd`. 0 combinaciones de tamaño e interlineado fuera de los 22 estilos de `DS:tokens.type`. 0 peticiones a `fonts.googleapis.com` o `fonts.gstatic.com`. | §14 |
| S6 | Tokens | Las propiedades CSS generadas tienen los 110 valores de `tokens.json`. 0 literales de color fuera de `src/design/tokens.json` y sus tres archivos generados (§3.2). 0 `!important`. 0 degradados y 0 sombras de caja de elevación. Los únicos `backdrop-filter` son los velos `overlay` (4 px) de la hoja móvil, la paleta de búsqueda y `Dialog` (§3.11, regla 10). | §14 |
| S7 | Sprites | Cada sprite de píxel se dibuja a escala entera con `image-rendering: pixelated`: alto mostrado / alto natural del archivo ∈ {1, 2, 3}. Se mide en alto porque cada hoja es una tira horizontal de un fotograma de alto y el ancho natural es el de todos los fotogramas (`src/lib/sprites/resolve.ts:137-140`). La única excepción es el Diamond del menú (0,5). Cada icono de navegación o de entidad sale de `sprites.json`. 0 iconos SVG fuera de la lista de glifos utilitarios. 0 imágenes rotas. | §14 |
| S8 | Dinero | Pruebas unitarias con la tabla de `DS:guias/40` en `es` y `en` (850; 2.500; 150.000; 1.500.000; 150.000.000; 1.200.000.000). Cada importe visible del juego lleva antes el sprite de Pokédólares o de Diamonds, y su nombre accesible es la cifra exacta. 0 apariciones de «KKs», «KK» o «gold» como palabra en el texto visible y en los diccionarios. | §14 |
| S9 | Números, fechas y vacíos | Pruebas unitarias del formateador. `es`: «1.800», «57.960», «−8,4%», «4.6» (X5), «18/09/2026, 14:32». `en`: «1,800», «Sep 18, 2026». Un valor desconocido se muestra «—», nunca «0» ni «N/D». | §14 |
| S10 | Sin relleno ni procedencia | Todas las filas de §12 cerradas. 0 coincidencias de la lista prohibida de §12 en el HTML de todas las rutas y en los diccionarios. 0 campos de procedencia en `content/schemas/*.json`. | §14 y revisión |
| S11 | Sin controles falsos | Cada `button`, `a[href]`, `[role="button"]` y `[role="tab"]` visible y habilitado produce un efecto comprobable: navega, cambia un estado, abre algo o copia. 0 elementos con aspecto de control y `aria-hidden="true"`, como los de T2. | §14 |
| S12 | Accesibilidad | axe con 0 violaciones `serious` o `critical` (etiquetas `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` y `wcag22aa`) en todas las rutas. Se repite con un tooltip abierto, un tooltip fijado, la hoja móvil, un popover «+N» y un select abiertos. Contraste calculado desde `tokens.json`: texto ≥ 4,5:1 y no texto ≥ 3:1, salvo los pares de `DS:README §Color` («Pares por debajo del mínimo»; §13.7, Q10). | §14 |
| S13 | Teclado y foco | Recorrido con Tab y Shift+Tab en todas las rutas. «Saltar al contenido» es el primer foco. Cada elemento enfocado calcula un `outline` de 2 px en `ring` con 1 px de separación y es el elemento que devuelve `elementFromPoint` en su centro, o lo contiene. Escape cierra tooltip, hoja, popover y select y devuelve el foco a su disparador. El orden sigue el visual; en una tarjeta: título, entidades anidadas, pie. | §14 |
| S14 | Táctil | A 390 × 844 con puntero grueso, todo objetivo interactivo mide al menos 44 × 44 (`size-touch`), salvo los enlaces dentro de un párrafo y los de filas de hechos (§13.7). El primer toque en un disparador abre su tooltip y el segundo navega. | §14 |
| S15 | Movimiento reducido | Con `prefers-reduced-motion: reduce`: `document.getAnimations().length === 0` 50 ms después de abrir un tooltip y la hoja móvil, y los sprites animados quedan en el fotograma 0. | §14 |
| S16 | Estabilidad y rendimiento | Presupuestos y métricas de laboratorio de §13.6 sobre el build de producción local: JS inicial, CSS, HTML y fuentes por página; LCP ≤ 2,5 s; CLS de página ≤ 0,02 y CLS en rejillas 0; INP ≤ 200 ms. | §14 |
| S17 | Peso de CSS | Tras `pnpm build`, la hoja compartida que carga cada página mide como máximo 100.000 B sin comprimir, y el CSS de cada página, 30 KB con gzip (§13.6). Hoy mide 203.705 B (§3.1). | §14 |
| S18 | Retiro del CSS actual | No existen `src/styles/legacy/` (los cinco CSS actuales, §3.10) ni `wiki-reference.css`, `home.css`, `trade.css` o `guides.css` en `src/styles/`; `src/styles/global.css` es solo la entrada nueva de §3.6. 0 clases `wiki-*` o `trade-*` en `src/`. | §14 |
| S19 | Datos | `pnpm content:check` en verde. Cambiar un registro de prueba cambia la cifra o el conteo que lo muestra. Con `OCULTAR_BORRADORES=1`, ningún registro `borrador` aparece. Sin `COMERCIO_DEMO`, ningún anuncio ni vendedor de `tests/fixtures/comercio/` aparece. | §14 |
| S20 | Documentación | `DESIGN.md`, `.impeccable/design.json` y `docs/DESIGN_DIRECTION.md` describen este diseño, sin menciones de «Codex Tooltip», `--cx-` ni Inter como fuente. `docs/DECISION_LOG.md` registra el rediseño y que reemplaza la parte visual de D-010. `docs/CURRENT_STATUS.md` y `docs/ROADMAP.md` están al día. | revisión |
| S21 | CI | `pnpm ci` y `pnpm test:e2e` pasan en local, y en GitHub Actions cuando el propietario suba los cambios. | §14 |
| S22 | Aceptación del propietario | El propietario revisa la vista previa local (`pnpm build` y `pnpm preview`, que sirve `.vercel/output` con `scripts/test/serve-vercel-output.mjs`, §14.3) página por página frente a su tablero. `astro preview` no sirve este proyecto: `@astrojs/vercel` 11.0.10 no tiene `previewEntrypoint` y Astro lo rechaza (`node_modules/astro/dist/core/preview/index.js:45-51`). Hasta que la apruebe, el estado es «implementado y verificado técnicamente; aceptación visual pendiente». Las pruebas automáticas no la sustituyen. | revisión |

**Criterios por fase.** Una fase cierra cuando pasan los criterios de su columna sobre las rutas y piezas que ya existen al terminarla. «Rutas de la fase» son las que esa fase migra a `PageLayout` (F2: §8, con el marcador de Comparar; F3: §9; F4: §10). Lo que una fase deja pasado sigue pasando en las siguientes.

| Criterio | F0 | F1 | F2, F3, F4 | Cierre del corte (tras F4) | F5 |
|---|---|---|---|---|---|
| S1 Marco | — | `/_paridad/` y una ruta de prueba con `PageLayout` | Rutas de la fase | Todas las rutas | Ruta de Comparar |
| S2 Rejillas | — | `/_paridad/tarjetas/` | Rutas de la fase | Todas | — |
| S3 Tooltip | — | `/_paridad/` | Rutas de la fase | Todas | Ruta de Comparar |
| S4 Tres vistas | — | `EntityList` en `/_paridad/` | Listas de la fase | Todas | — |
| S5 Tipografía | Tokens y `fonts.css` | Componentes | Rutas de la fase | Todas | Ruta de Comparar |
| S6 Tokens | Valores generados; `design:check` sobre los archivos nuevos | Ídem | Ídem | Todo `src/` (tras §3.10 paso 4) | Ídem |
| S7 Sprites | Adaptador | Componentes | Rutas de la fase | Todas | Ruta de Comparar |
| S8 Dinero | — | Formateadores y componentes | Rutas de la fase | Todas | — |
| S9 Números, fechas y vacíos | Formateadores | Componentes | Rutas de la fase | Todas | Ruta de Comparar |
| S10 Sin relleno ni procedencia | Esquemas | Diccionarios | Rutas de la fase y sus filas de §12 | Todas las filas de §12 | Filas de §12.13 |
| S11 Sin controles falsos | — | Componentes | Rutas de la fase | Todas | Ruta de Comparar |
| S12 Accesibilidad | Contraste de tokens | `/_paridad/` | Rutas de la fase | Todas | Ruta de Comparar |
| S13 Teclado, S14 Táctil, S15 Movimiento reducido | — | `/_paridad/` | Rutas de la fase | Todas | Ruta de Comparar |
| S16 Estabilidad y rendimiento | — | Prototipo de la Pokédex (§13.6) | Páginas medidas de la fase | Todas las de §13.6 | Ruta de Comparar |
| S17 Peso de CSS, S18 Retiro del CSS actual | — | — | — | Sí | Sí |
| S19 Datos | `content:check` | — | Registros de la fase | Sí | — |
| S20 Documentación | — | — | — | Sí | — |
| S21 CI | Sí | Sí | Sí | Sí | Sí |
| S22 Aceptación del propietario | — | — | — | Sí | Ruta de Comparar |

---

## 3. Arquitectura CSS y tokens

### 3.1 Punto de partida (árbol de trabajo del 2026-09-19)

| Archivo | Líneas | Qué contiene hoy | Destino |
|---|---|---|---|
| `src/styles/global.css` | 3.146 | `@import 'tailwindcss'` y `@import 'tw-animate-css'` (:1-2); `@theme inline` con los alias de shadcn (:4-29); `:root` con literales shadcn, `--font-body`, `--font-display`, `--font-code`, `--signal`, `--panel*` y `--link` (:31-57); `@layer base` (:59) con `scroll-behavior: smooth` sin guarda de movimiento (:69), foco con 2 px de separación (:77-80) y `::selection` `#3730a3` (:82-83); `@layer components` (:97); `@layer legacy-wiki` (:2345-3023); CSS de Guild sin capa (:3025-3146) | se borra (§3.10) |
| `src/styles/wiki-reference.css` | 5.257 | Sin capa. `:root` con 25 variables `--wiki-*` (:7-33); `@view-transition` y grupo de 220 ms (:1549-1556); `--dex-*` (:1560-1565); movimiento reducido con grupos de 1 ms (:2899-2903); 5 `!important` (:845, :3545, :3920, :4614, :4615) | se borra |
| `src/styles/home.css` | 398 | Sin capa. `--home-pokemon-color` (:155-179). Lo importa `src/pages/[locale]/index.astro:3` | se borra |
| `src/styles/trade.css` | 1.042 | Sin capa. `--trade-*` (:705-710). Lo importa `src/pages/[locale]/comercio/index.astro:9` | se borra |
| `src/styles/guides.css` | 308 | Sin capa. Lo importa `src/pages/[locale]/guias/index.astro:3` | se borra |

- `src/layouts/AppLayout.astro:2-3` importa `global.css` y `wiki-reference.css`; `:96` fija `theme-color` con el literal `#111318`; `:102` incluye `SpriteStyles`.
- Hoja compartida del último build local (`dist/client/_astro/AppLayout.C3B46Amr.css`): 203.705 B sin comprimir. El `components/bundle.css` del DS mide 111.704 B; minificado con el `lightningcss` 1.33 del repo, 75.807 B (10.702 B con gzip).
- Nombres de transición en línea que se retiran: `src/components/wiki/PokedexGrid.tsx:293` y `:316` (un nombre por tarjeta) y `src/pages/[locale]/pokedex/[slug].astro:68` y `:99`.

### 3.2 Fuente única de tokens

- `src/design/tokens.json` es una copia byte a byte de `tokens.json` del DS, más los tokens de §3.3. Es el único archivo del repo donde se escribe un valor de diseño.
- Un token nuevo o un valor cambiado entra a la vez en `tokens.json` del DS publicado y en `src/design/tokens.json` (R16); la revisión del cambio comprueba que los dos coinciden. El DS no vive en el repo, así que CI no puede compararlos.
- `scripts/design/tokens.mjs` (Node, sin dependencias nuevas) lee `src/design/tokens.json` y escribe tres archivos generados, cada uno con la primera línea `/* GENERADO por scripts/design/tokens.mjs desde src/design/tokens.json. No editar. */` (en `.ts`, el mismo texto con `//`):
  - `src/styles/tokens.css` (§3.4);
  - `src/styles/theme.css` (§3.5);
  - `src/lib/design/tokens.ts`: los mismos valores para código que no puede leer CSS. Consumidores: `<meta name="theme-color">` (`color.bgPrimary`, `#0c0e12`, en lugar de `AppLayout.astro:96`) y el PNG de Guild (hoy 11 literales de color en `src/lib/tools/guild-ranking-image.ts`).
- `package.json`: `"design:tokens": "node scripts/design/tokens.mjs"` escribe; `node scripts/design/tokens.mjs --check` regenera en memoria, compara byte a byte y sale con código 1 nombrando el archivo desfasado. `--check` forma parte de `pnpm design:check` (§3.11), que entra en `pnpm ci`.

### 3.3 Tokens que se añaden al DS

Solo ponen nombre a literales que el DS ya usa (`DS:README §Movimiento`, `components/bundle.css`) o a dos valores que el marco necesita y el DS no fija.

| Grupo | Token | Valor | Uso |
|---|---|---|---|
| `motion` (grupo nuevo) | `duration-fast` | `150ms` | Colores de hover, entrada del tooltip, velo de la hoja y de la paleta, flecha de Destacados |
| `motion` | `duration-sprite-in` | `300ms` | Fundido del sprite al terminar de cargar |
| `motion` | `duration-sheet` | `500ms` | Entrada de la hoja móvil |
| `motion` | `duration-pulse` | `2s` | Pulso del cuadro de carga de un sprite |
| `motion` | `duration-bounce` | `5s` | Rebote de sprites en Destacados y en el grupo «Destacados» del menú |
| `motion` | `ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Toda transición y entrada salvo pulso y rebote |
| `motion` | `ease-pulse` | `cubic-bezier(0.4, 0, 0.6, 1)` | Pulso de carga |
| `motion` | `ease-bounce` | `ease-in-out` | Rebote |
| `zIndex` | `z-header` | `30` | Cabecera fija: sobre el contenido, bajo el tooltip (40) y el velo (50) |
| `layout` | `layout-main-max` | `1536px` | Tope de la columna principal (RUB §1.1, `max-w-9xl`). Se alcanza desde 2.080 px de ventana con rail y desde 2.032 sin él; por debajo no cambia nada |

La duración de cada fotograma del Diamond (110 ms) no es un token: vive en `public/sprites/sprites.json` (`ui/diamond`, `duracionMs`), como toda animación de sprite (D-011).

### 3.4 `tokens.css`: nombres y reparto

Cada token conserva su nombre del DS como propiedad CSS: `--bg-primary`, `--text-tertiary`, `--space-16`, `--radius-12`, `--ring-selected`, `--layout-header`, `--size-cell`, `--grid-dex`, `--opacity-partial`, `--z-tooltip`, `--duration-fast`. Así el CSS de `components/bundle.css` se porta sin renombrar variables. No hay prefijos (`--cx-`, `--wiki-`, `--trade-` desaparecen, T5).

El generador reparte los tokens en dos bloques según choquen o no con un espacio de nombres de Tailwind 4:

| Bloque | Tokens | Motivo |
|---|---|---|
| `@theme static { … }` | Reinicio `--*: initial`; `--spacing: 1px`; `--breakpoint-md: 48rem` y `--breakpoint-xl: 80rem` (de `layout-bp-md` y `layout-bp-xl` ÷ 16); `--default-transition-duration: var(--duration-fast)`; `--default-transition-timing-function: var(--ease-standard)`; `--default-font-family: var(--font-sans)`; `--default-mono-font-family: var(--font-mono)`; los 9 `--radius-*`; `--font-sans`, `--font-game`, `--font-mono` (de `type.families`); `--text-shadow-game`; `--ease-standard`, `--ease-pulse`, `--ease-bounce` | Su nombre del DS ya es un nombre de tema de Tailwind (`--radius-*`, `--font-*`, `--text-shadow-*`, `--ease-*`). Declararlos aquí con su valor literal crea la utilidad (`rounded-12`, `font-game`, `text-shadow-game`, `ease-standard`) sin una variable que se refiera a sí misma. `static` los emite siempre, se usen o no en clases |
| `@layer theme { :root { … } }` | Todos los demás: 31 colores, 12 espacios, las 3 sombras restantes, 15 de layout, 24 tamaños, 8 de rejilla, 3 opacidades, 6 capas z, 5 duraciones | `--text-primary` dentro de `@theme` crearía una utilidad de tamaño de letra `text-primary`; `--space-*`, `--layout-*`, `--size-*`, `--grid-*`, `--z-*` y `--duration-*` no son espacios de nombres de Tailwind |

- Comprobado con `@tailwindcss/node` 4.3.3 del repo: con este reparto, `text-sm`, `font-bold`, `rounded-lg`, `shadow-sm`, `bg-red-500` y las variantes `sm:`, `lg:` y `2xl:` no generan CSS; `rounded-12` compila a `border-radius: var(--radius-12)` y `:root` contiene `--radius-12: 12px` una sola vez.
- Un solo tema, «Oscuro» (`DS:tokens.color.themes`): los colores van en `:root`, sin `[data-theme]`. `<html class="dark">` (T1), `color-scheme: dark` en `base.css`, `<meta name="color-scheme" content="dark">` y `<meta name="theme-color">` desde `tokens.ts`. Si Q6 trae un tema claro, el generador añade un bloque `:root[data-theme="light"]` con los mismos 31 nombres; ningún componente cambia.
- Propiedades locales de un componente (como `--ac-cols` y `--ac-gap` de `CardGrid` en `bundle.css`): prefijo `--ac-`, declaradas dentro de la regla del componente, con valores que son tokens o cálculos sobre tokens.

### 3.5 `theme.css`: utilidades

Generado. Contiene un bloque `@theme inline` y 22 `@utility`.

| Utilidad | Sale de | Ejemplos |
|---|---|---|
| Fondo | `--background-color-<x>: var(--bg-<x>)` | `bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-quaternary` |
| Texto | `--text-color-<x>: var(--text-<x>)` | `text-primary` … `text-quinary` |
| Borde | `--border-color-<x>: var(--border-<x>)` | `border-primary`, `border-secondary` |
| Resto de colores, con cualquier prefijo de color (`bg-`, `text-`, `border-`, `outline-`, `fill-`, `stroke-`) | `--color-<nombre>: var(--<nombre>)` para `helper`, `link`, `link-prose`, `white`, `black`, `ring`, `selected`, `amber`, `banner`, `inactive-row`, `overlay` y los 9 `tt-*` | `text-link`, `outline-ring`, `border-selected`, `bg-banner`, `bg-tt-panel` |
| Sombras | `--shadow-ring-selected`, `--shadow-inset-missing`, `--shadow-inset-tt-empty` | `shadow-ring-selected` |
| Radios, familias, sombra de texto, curvas | `@theme static` de §3.4 | `rounded-8`, `font-game`, `text-shadow-game`, `ease-standard` |
| Estilos de texto | `@utility type-<estilo>` por cada uno de los 22 estilos de `DS:tokens.type` (§4.1) | `type-body`, `type-ui-strong`, `type-tt-row` |
| Espacio | `--spacing: 1px`: el número de la utilidad es el valor en px, como en el nombre de los tokens | `p-16`, `gap-8`, `mt-48`, `px-12` |
| Medidas de token | Sintaxis de variable de Tailwind 4 | `w-(--layout-sidebar)`, `size-(--size-cell)`, `z-(--z-tooltip)`, `duration-(--duration-fast)`, `opacity-(--opacity-partial)` |
| Puntos de corte | `--breakpoint-md`, `--breakpoint-xl` | `md:` (≥ 768), `xl:` (≥ 1280), `max-md:`, `max-xl:` |

- Cada `@utility type-<estilo>` declara `font-size`, `line-height` y `font-weight`; además `font-family` si la familia no es `sans` (`kbd` → `--font-mono`; `tt-*` → `--font-game`), `font-style: italic` en `note` y `ui-step`, `letter-spacing` en `brand`, `ui-caps`, `tt-title`, `tt-row` y `tt-hint`, y `text-transform: uppercase` en `ui-caps` y `tt-title`.
- Los nombres de color son los del DS: `text-primary` es el token de texto `text-primary` y `bg-primary`, el fondo `bg-primary`. No existen `bg-background`, `text-foreground`, `bg-muted` ni ninguna clase de la paleta de Tailwind.

### 3.6 Entrada única y capas

`src/styles/global.css` es la única hoja del sitio. La importa solo `src/layouts/PageLayout.astro`; ninguna página ni componente importa CSS.

```css
/* src/styles/global.css */
@layer properties, theme, base, components, utilities;
@import 'tailwindcss';
@import './tokens.css';
@import './theme.css';
@import './fonts.css';
@import './base.css' layer(base);
@import './components/skip-link.css' layer(components);
@import './components/page-layout.css' layer(components);
/* … un @import por archivo de src/styles/components/, con layer(components), en el orden de bundle.css */
@import './motion.css';
```

- Orden de capas: `properties < theme < base < components < utilities`. `properties` va primero porque Tailwind 4.3 emite `@layer properties`; una utilidad siempre gana a una regla de componente, así que `className="mt-16"` ajusta un componente sin especificidad extra.
- Fuera de capa solo quedan `fonts.css` (`@font-face`, §3.9) y `motion.css` (`@keyframes ac-*`, §6.2). `tokens.css` declara sus propias capas (§3.4).
- `base.css` (capa `base`): `html` con `color-scheme: dark`, fondo `--bg-primary` y `scroll-padding-top: var(--layout-header)`; `body` con `margin: 0`, fondo `--bg-primary`, color `--text-primary`, `font-family: var(--font-sans)`, `@apply type-base` y `-webkit-font-smoothing: antialiased` (base del DS); `:focus-visible { outline: 2px solid var(--ring); outline-offset: 1px }`; `::placeholder { color: var(--text-quaternary); opacity: 1 }`; `:where(p) a:not([class])` en `--link-prose` y subrayado; `scroll-behavior: smooth` solo dentro de `@media (prefers-reduced-motion: no-preference)`. No hay regla `::selection`: el DS no la define y el literal `#3730a3` desaparece.
- Una hoja para todo el sitio, cacheada entre páginas. Presupuesto: ≤ 100.000 B sin comprimir (S17).
- 0 `!important` en todo el CSS (T6). El movimiento reducido no se resuelve con `!important` sino declarando todo movimiento dentro de `@media (prefers-reduced-motion: no-preference)` (§6.4).

### 3.7 Clases de componente y utilidades

| Uso | Se escribe con | Dónde |
|---|---|---|
| Estilo interno de un componente del DS | Clases `ac-<bloque>`, elementos `ac-<bloque>__<elemento>`, modificadores `ac-<bloque>--<modificador>`, con los nombres exactos de `components/bundle.css` | `src/styles/components/<bloque>.css`, un archivo por componente del DS, capa `components` |
| Estado | Atributos ARIA o `data-*` (`[aria-current="page"]`, `[aria-pressed="true"]`, `[aria-expanded="true"]`, `[data-open]`), nunca clases de estado inventadas | Mismo archivo del componente |
| Composición de una página (colocar componentes, separación entre bloques que no fija el componente, mostrar u ocultar por punto de corte) | Utilidades de Tailwind en el marcado | `.astro` de página y plantillas |
| Ajuste puntual de una instancia | Utilidades en la prop `class`/`className`, que el componente añade al final de sus clases (§3.8) | Llamada al componente |

- Valores en el CSS de componente: solo `var(--token)`, cálculos sobre tokens, `0`, `1px`, `-1px` y `2px`. Un número sin token lleva en la misma línea un comentario `/* sin token: … */` que dice qué es, como hace `bundle.css` (el ancho 192 del selector de idioma, la marca Shiny de 13 × 14).
- Tipografía en el CSS de componente: solo `@apply type-<estilo>`. El par literal `font-size: 12px; line-height: 16px; /* ui */` de `bundle.css` se porta como `@apply type-ui;`. Cada par tamaño/interlineado de `bundle.css` es uno de los 22 estilos (comprobado regla a regla).
- `.ac-sr` de `bundle.css` se porta como la utilidad `sr-only` de Tailwind.
- Prohibido en clases: valores arbitrarios con literales (`w-[123px]`, `bg-[#fff]`, `text-[10px]`), la variante `dark:`, las utilidades `ring-*` (el anillo de selección es `shadow-ring-selected`; el de foco, `outline`), `transition*`, `animate-*` y `duration-*` sin la variante `motion-safe:` (§6.4).
- Prohibido en `style`: colores y medidas literales. Solo se admiten valores que dependen de datos (C-R2): la geometría de un sprite (`width`, `height`, `left`, `top`, `object-position`), `grid-row` de una tarjeta, la posición que calcula `@floating-ui/dom` para un tooltip o popover y las propiedades locales `--ac-*`.

### 3.8 base-ui, shadcn, primitivos nativos y dependencias

**Regla.** El marco no hidrata React; en una página sin lista ni herramienta la única isla es la paleta de búsqueda, en `client:idle` (§7.3, C7-01). Los componentes del DS se escriben a mano (§7): Astro sin JavaScript cuando basta, TSX dentro de islas y scripts sin React para lo que abre y cierra. Todos pintan las mismas clases `ac-*`.

**Primitivos nativos** en lugar de librerías de componentes:

| Necesidad | Primitivo | Componente (§7) |
|---|---|---|
| Modal con foco atrapado, Escape y resto de la página inerte | `<dialog>` con `showModal()` | `MobileMenu` (`#menu-movil`), paleta de búsqueda (`#buscar-dialogo`), `Dialog` (§7.2.8) |
| Casillas, opciones y texto largo | `<input type="checkbox">`, `<input type="radio">` dentro de `<fieldset>`, `<textarea>` | `Checkbox`, `RadioGroup`, `Textarea` (§7.2.8) |
| Capa superior sin recorte por `overflow`, cierre ligero | Atributo `popover` (`auto` en el listado de idiomas; `manual` en tooltips del juego, «+N» y listado de `Select`) | `LanguageMenu`, `NestedEntity`/`GameTooltip`, `PlusN`, `Select` |
| Plegar sin JavaScript, con estado expandido expuesto | `<details>` / `<summary>` | Grupos de `Sidebar`, secciones de `GameTooltip` |
| Conmutadores | `<button aria-pressed>` | `ToggleGroup`, `ViewToggle`, `Button pressed` |

**base-ui.** Ningún componente del DS usa `@base-ui/react` (§7.13): no ofrece un tooltip con enlaces que se fije con Shift y abra con el primer toque, y el `<dialog>` y el `popover` nativos cubren el resto sin hidratar React. Las piezas que el DS no tiene (`Dialog`, `Combobox`, `Checkbox`, `RadioGroup`, `Textarea`) también se hacen con primitivos nativos (§7.2.8). Los 9 archivos de `src/components/ui/` (757 líneas) se borran con sus únicos consumidores (§7.12): `button.tsx`, `input.tsx` y `kbd.tsx` con `WikiSearch.tsx`, `ContentSearch.tsx` y la herramienta de Guild actual; `badge.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `sheet.tsx`, `tabs.tsx` y `textarea.tsx` con la herramienta de Guild actual.

**shadcn.** Se retira. Lo que genera `shadcn add` usa nombres (`bg-primary text-primary-foreground`) que en este tema significan otra cosa o no existen. `components.json` (estilo `base-nova`, `iconLibrary: lucide`) se borra.

**Fusión de clases.** No hace falta: un componente pinta sus clases `ac-*` y añade al final el `class`/`className` de quien lo usa; como las utilidades viven en una capa posterior (§3.6), ganan sin fusionar. Un componente nunca genera utilidades internas que compitan con las de quien lo usa. `cn` y `src/lib/utils.ts` salen con sus consumidores.

**Glifos.** `lucide-react` solo a través de `src/components/icons/Glyph.tsx` (C-R7): los glifos utilitarios de `DS:README §Iconografía`, trazo 2 (2,5 en los de 12 px), `currentColor`, `aria-hidden`. `moon` no está en la lista mientras Q6 no traiga un tema claro. ESLint `no-restricted-imports` prohíbe `lucide-react` en cualquier otro archivo.

**Dependencias (R17).**

| Cambio | Paquete | Motivo | Peso |
|---|---|---|---|
| Se añade | `@floating-ui/dom` 1.8.0 (depende de `@floating-ui/core` y `@floating-ui/utils`) | Posición de tooltips del juego, «+N», listado de `Select` y de `Combobox`, `LanguageMenu` y tooltip de la paleta (§7): volteo y desplazamiento dentro de la ventana, que CSS no resuelve en todos los navegadores de destino | Cota superior: los builds minificados completos de `dom` (9.855 B) y `core` (12.387 B) de jsDelivr suman 22.242 B, 8.741 B con gzip. El chunk real es menor: solo entran `computePosition`, `offset`, `flip`, `shift` y `autoUpdate`. Lo importan solo los scripts de §7 que posicionan capas (controlador de tooltips, `popover-anchor.ts`, `Select`, `Combobox`, paleta) |
| Se retira | `tw-animate-css` | Su único consumidor es `global.css:2` | — |
| Se retira cuando no quede consumidor | `@base-ui/react`, `class-variance-authority`, `cn`, `shadcn` | Ver arriba | — |
| Se conserva | `lucide-react` | Glifos utilitarios | Solo los glifos importados |
| Se añade | `@astrojs/sitemap` | Sitemap con las alternativas de idioma (§13.5) | Solo en el build; 0 B en el cliente |

No se añade ninguna otra dependencia de producción; las de desarrollo están en §14.1. Las fuentes se copian al repo (§3.9).

### 3.9 Fuentes

| Familia (`DS:tokens.type.families`) | Pila | Pesos | Carga | Uso |
|---|---|---|---|---|
| `sans` | `Verdana, "DejaVu Sans", "Bitstream Vera Sans", system-ui, sans-serif` | 400, 700 | Del sistema; no se autoaloja | Todo el sitio |
| `game` | `Poppins, Verdana, sans-serif` | 600 (`tt-title`, `tt-row`), 500 (`tt-hint`) | Autoalojada, subconjunto latin | Solo `GameTooltip` (tooltip, ficha fija del Pokémon y ficha del anuncio) y el tooltip compacto del gráfico de Guild (R2, Q14, S5) |
| `mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | 400 | Del sistema | Solo el keycap «Ctrl + K» |

**Poppins:**
- Archivos: `src/assets/fonts/poppins-latin-500-normal.woff2` (7.748 B) y `src/assets/fonts/poppins-latin-600-normal.woff2` (8.000 B), copiados de `@fontsource/poppins` 5.3.0 (`files/`), con su licencia en `src/assets/fonts/OFL.txt` (OFL-1.1). No se añade el paquete como dependencia.
- `src/styles/fonts.css`, una regla por peso:

```css
@font-face {
  font-family: Poppins;
  font-style: normal;
  font-weight: 600; /* y otra regla igual con 500 y su archivo */
  font-display: swap;
  src: url('../assets/fonts/poppins-latin-600-normal.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
    U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
```

- El `unicode-range` es el del subconjunto latin de `@fontsource/poppins` 5.3.0 (`600.css`). Cubre el español y el inglés, incluidas é, ñ, ¿, ¡, «», … y el signo menos U+2212. Un carácter fuera del rango se dibuja con Verdana, la siguiente de la pila.
- El nombre de familia es literalmente `Poppins`, así `--font-game` queda igual que en `tokens.json`. No se usa la API `fonts` de Astro: su proveedor nombra la familia `Poppins-<hash>` (`node_modules/astro/dist/assets/fonts/core/resolve-family.js:12`) y obligaría a reescribir `--font-game`.
- Carga, sin precargas que queden sin usar (los paneles cerrados no piden la fuente y Chromium avisa de una precarga que no se usa en unos segundos):
  - Precarga solo en las páginas que pintan Poppins al cargar: la ficha de Pokémon (§8.3) y el detalle del anuncio (§9.6). `PageLayout` recibe `preloadGameFont` y pinta `import poppins600 from '../assets/fonts/poppins-latin-600-normal.woff2?url'` (ídem 500) con `<link rel="preload" href={poppins600} as="font" type="font/woff2" crossorigin />`. Vite da la misma URL con hash al `import ?url` y al `url()` de `fonts.css`; la prueba V3-6 lo comprueba.
  - En el resto, `scripts/game-tooltip.ts` pide los dos pesos con `document.fonts.load('600 12px Poppins')` y `document.fonts.load('500 12px Poppins')` en el primer `pointerover` o `focusin` sobre un `[data-ac-tt]` o una barra del gráfico, o en `requestIdleCallback` tras `load` (sin la API, `setTimeout` de 2 s), lo que ocurra antes. Un tooltip abierto antes de que llegue la fuente se dibuja con Verdana y cambia con `font-display: swap`.
- 0 peticiones a `fonts.googleapis.com` o `fonts.gstatic.com` (X8, S5). La primera línea de `bundle.css` (`@import url("https://fonts.googleapis.com/…")`) no se porta.
- Solo existen los pesos 500 y 600 y ningún estilo de §4.1 pide otro. Dentro de las superficies con Poppins no se usan `<strong>` ni `<b>`, así el navegador nunca sintetiza una negrita.

**Verdana:** pesos 400 y 700 reales; `<strong>` y `<b>` calculan 700. Donde Verdana no está instalada (por ejemplo, Linux con DejaVu o Android), se usa la siguiente familia de la pila. Las pruebas de navegador de Linux (§14.3) dibujan con DejaVu Sans y las visuales corren en Windows con Verdana (§14.5). La geometría del marco no depende de la anchura del texto.

### 3.10 Migración y borrado

1. **Apartar lo viejo.** Mover (sin commit) los cinco CSS a `src/styles/legacy/`, actualizando sus cinco imports (`AppLayout.astro:2-3`, `src/pages/[locale]/index.astro:3`, `comercio/index.astro:9`, `guias/index.astro:3`). Sin cambio visual.
2. **Base nueva (F0).** `src/design/tokens.json`, el generador y sus tres salidas, `global.css` nuevo, `base.css`, `fonts.css`, `motion.css`, `src/styles/components/` y `src/layouts/PageLayout.astro` (marco de §5).
3. **Página a página (F2–F4).** Cada ruta pasa de `AppLayout` a `PageLayout` en la fase de su sección (§8–§10); Comparar Pokémon pasa en F2 como marcador (§8.14), así el paso 4 no espera a F5. Una ruta nunca carga las dos hojas, y una página migrada no usa ningún componente viejo: las clases de las islas viejas (`bg-primary` de shadcn, por ejemplo) significan otra cosa en la hoja nueva.
4. **Cierre.** Cuando ninguna ruta importa `AppLayout`, se borran en un mismo cambio:
   - `src/layouts/AppLayout.astro` y `src/styles/legacy/` (los cinco archivos, 10.151 líneas);
   - con ellos, todas las variables viejas: alias shadcn (`--background`, `--foreground`, `--card*`, `--popover*`, `--primary*`, `--secondary*`, `--muted*`, `--accent*`, `--destructive`, `--border`, `--input`), `--signal`, `--panel*`, `--link`, `--font-body`, `--font-display`, `--font-code`, las 25 `--wiki-*`, las 6 `--trade-*`, las 6 `--dex-*` y `--home-pokemon-color`. `--ring` sobrevive con el significado del DS (el mismo valor, `#444ce7`);
   - todas las clases `wiki-*`, `trade-*`, `guild-*`, `pokemon-*`, `map-*`, `tool-*`, `compare-*`, `eyebrow`, `display-title`, `section-title` y `skip-link`: ninguna clase vieja sobrevive (S18);
   - los 9 archivos de `src/components/ui/`, `src/lib/utils.ts`, `components.json` y las dependencias `tw-animate-css`, `@base-ui/react`, `class-variance-authority`, `cn` y `shadcn` (§3.8);
   - `@view-transition` y los nombres de transición viejos (§3.1).

### 3.11 Reglas verificables (`pnpm design:check`)

`scripts/design/check.mjs`, sin dependencias nuevas, falla con `archivo:línea` si:

1. `tokens.mjs --check` encuentra un archivo generado desfasado.
2. Hay un literal de color (hex, `rgb(`, `rgba(`, `hsl(`, `oklch(`, `color-mix(` o un color con nombre en una propiedad de color, salvo `transparent`, `currentColor` e `inherit`) fuera de `src/design/tokens.json` y sus tres archivos generados.
3. Hay `font-size` o `line-height` fuera de `theme.css`; `letter-spacing` distinto de `normal` fuera de `theme.css`; `font-family` con un valor distinto de `var(--font-sans)`, `var(--font-game)`, `var(--font-mono)` o `inherit` fuera de `tokens.css` y `fonts.css`; o `font-weight` distinto de 400, 500, 600, 700 o `inherit`.
4. Una longitud en `src/styles/components/*.css` no es un token, un cálculo sobre tokens, `0`, `1px`, `-1px` o `2px`, y no lleva el comentario `/* sin token: … */` en la misma línea.
5. Una media query de ancho usa un valor distinto de `48rem` u `80rem`, salvo `64rem` en `info-banner.css`, `36rem` en `breadcrumb.css` y `28.75rem` en `page-title.css` (§5.4). Se exige la sintaxis de rango (`width < 80rem`, `width >= 48rem`).
6. Aparece `!important`, `@layer` con un nombre distinto de los cinco de §3.6, `dark:`, una utilidad `ring-*`, un valor arbitrario con literal (`-[` seguido de un número con unidad o de `#`), un modificador de opacidad en una utilidad de color (`bg-selected/20`: produce un color que no es un token), o una utilidad `transition*`, `animate-*` o `duration-*` sin `motion-safe:`.
7. Una declaración `animation`, `animation-*`, `transition` o `transition-*` está fuera de un bloque `@media (prefers-reduced-motion: no-preference)` (§6.4).
8. Un `.astro`, `.tsx` o `.ts` fuera de `PageLayout.astro` importa un `.css`.
9. Un archivo fuera de `src/components/icons/Glyph.tsx` importa `lucide-react`, o un archivo importa `@base-ui/react`, `class-variance-authority`, `cn` o `tw-animate-css`.
10. `backdrop-filter` aparece fuera de las reglas del velo `::backdrop` de `MobileMenu`, de la paleta de búsqueda y de `Dialog`. Las tres siguen al token `overlay` («Velo al 80 % detrás de la hoja móvil y de los diálogos, con blur de 4 px»).
11. Una duración literal (`\d+(\.\d+)?m?s`) o `cubic-bezier(` aparece fuera de los archivos de tokens. Excepción: las duraciones de sprites que `src/lib/sprites/resolve.ts` escribe desde `duracionMs` del registro.

`scripts/design/check-dist.mjs`, tras `pnpm build`: cada HTML de `dist/client` enlaza exactamente una hoja del sitio y esa hoja mide ≤ 100.000 B (S17); ningún `.html`, `.css` o `.js` de `dist/client` contiene `fonts.googleapis.com` ni `fonts.gstatic.com`.

Mientras dure la migración (§3.10, pasos 1 a 3), `src/styles/legacy/`, `AppLayout.astro`, sus tres imports de página, las rutas que aún usan `AppLayout` y los archivos que §7.12 marca para borrar quedan fuera de las reglas 2 a 11 y de `check-dist.mjs`. Desde el paso 4 las reglas cubren todo `src/` y todo `dist/client`.

### 3.12 Adaptador de sprites y lectura de registros

- **Sprites.** El adaptador es el `Sprite` de §7.4 (`src/components/game/Sprite.tsx`, con la API por clave del registro que hoy tienen `src/components/sprites/Sprite.astro` y `Sprite.tsx`). Reglas de arquitectura que §7.4 cumple:
  - ningún componente recibe una URL de sprite escrita a mano ni importa `public/sprites/sprites.json` por su cuenta (C7-15);
  - fotograma y animación sin JavaScript: `object-position` para el fotograma y `@keyframes` generadas en el build desde `duracionMs` del registro, con `steps(1, end)` y solo dentro de `@media (prefers-reduced-motion: no-preference)` (hoy `src/lib/sprites/resolve.ts:166-181`). La inyección de keyframes en el cliente de `bundle.js` (`ensureKeyframes`) no se porta;
  - `SpriteStyles.astro` se incluye una sola vez, en el `<head>` de `PageLayout`;
  - sprites de píxel con `image-rendering: pixelated` a escala entera; ilustraciones con `smooth` (hoy siempre `pixelated`: `Sprite.tsx:37`, `Sprite.astro:35`).
- **Registros.** Las páginas leen `content/*.json` solo con las funciones de `src/lib/content/registry.ts` (validadas con Zod en el build) y las islas leen `sprites.json` con `src/lib/sprites/registry.ts`. Los registros `borrador` se filtran con `withoutDrafts` y `hideDrafts` (`registry.ts:48-55`, `OCULTAR_BORRADORES=1`). Ninguna página ni componente importa un JSON de `content/` directamente.

### 3.13 Configuración, rutas y registros

- **`astro.config.mjs`.** Hoy solo fija `output: 'server'`, el adaptador de Vercel, la integración de React y el plugin de Tailwind. Se añaden:
  - `site: 'https://pokealliance-codex.vercel.app'` y la integración `@astrojs/sitemap` (§13.5);
  - `redirects` con las 302 de §8.0.1 y §8.13: `/` → `/es/`, `/{l}/mapa/aportar/` → `/{l}/mapa/`, `/{l}/rotaciones/` → `/{l}/pokedex/tiers/` y `/{l}/guias/` → `/{l}/actividades/`, cada una con y sin barra final;
  - `prefetch` (§6.1) y `devToolbar: { enabled: false }` (§14.3);
  - el alias `@content` de `vite.resolve.alias`: `content/` en el build normal y `tests/visual/content/` con `VISUAL=1`, que además inyecta las rutas `/_paridad/*` y lee Comercio de `tests/visual/fixtures/comercio.json` (§14.5);
  - la integración local `src/integrations/comercio-fases.ts` (§9.3), antes de `react()`.
- **Barra final.** `trailingSlash` conserva el valor por defecto de Astro (`'ignore'`). La URL canónica lleva barra final (§13.5) y una ruta sin barra llega a su página con como mucho una redirección (RZ2, RZ3).
- **Render.** Todo se prerenderiza salvo `src/pages/404.astro` (`prerender = false`: la página toma el idioma de la ruta pedida, §8.12) y las rutas de Comercio que la fase B sirve bajo demanda. Esas rutas no exportan `prerender`: su modo lo fija `comercio-fases.ts` en el hook `astro:route:setup` (§9.3). Astro solo acepta un literal en `export const prerender` (`node_modules/astro/dist/core/routing/prerender.js`, `PRERENDER_REGEX`), así que un archivo no puede elegir su modo según una variable.
- **Variables de entorno.** `OCULTAR_BORRADORES` (R7), `COMERCIO_DEMO` y `COMERCIO_PUBLICO` (§9.2) se leen igual en build y en servidor, con la misma función que `hideDrafts` (`src/lib/content/registry.ts:35-51`). `VISUAL` solo existe en el build visual e implica `COMERCIO_DEMO` con el fixture de §14.5.
- **Supabase.** Un solo módulo de cliente para Comercio, Guild y `/{l}/cuenta/`. La ruta de cuenta solo se genera si `getSupabasePublicConfig()` (`src/lib/supabase/env.ts`) no es `null` (§9.3). Las migraciones son solo locales (§9.12, §10.13).
- **Diccionarios.** `src/i18n/messages/{es,en}.ts` (§13.2).
- **Temporal.** Ningún chunk de cliente importa `@js-temporal/polyfill`, salvo la isla de Guild: su motor (`src/lib/tools/guild-ranking.ts:1`, `guild-daily-history.ts:1`, `src/lib/supabase/guilds.ts:1` y el nuevo `guild-analytics.ts`, §10.3) trabaja con `Temporal.PlainDate`. El polyfill (45,3 KB con gzip en el build actual, chunk compartido `server-save.*.js`) cuenta dentro de los 200 KB de Guild (§13.6). Los formateadores de §13.3 y `src/lib/time/server-save.ts` no lo usan.
- **Registros nuevos y campos nuevos:** forma exacta en la tabla siguiente. Cada registro nuevo tiene su esquema en `content/schemas/` (draft 2020-12, claves en español) y entra en `pnpm content:check`.
- **Validaciones nuevas de `pnpm content:check`:** referencias a entidades resueltas; rutas de Destacados que existen; ningún `id` de Pokémon igual a `tiers`; importes del juego como enteros, nunca en texto libre; nombre en los dos idiomas para cada elemento presente en `content/pokemon.json`; `drops[].cantidad.max ≥ min`; un `evolucion[].a` que existe y ninguna cadena circular; las claves de procedencia de §12.19 rechazadas.

#### Forma de los registros

Convenciones: `Texto` = `{ "es": string, "en": string }`; `Ref` = `{ "tipo": "pokemon" | "item" | "sistema" | "actividad", "id": string }`; `SpriteKey` = clave de `public/sprites/sprites.json`. Un campo marcado «opcional» puede faltar; mientras falte, su zona, fila, columna o sección no se renderiza (§8.0.5). `null` es «desconocido» (X13).

| Registro o campo | Forma | Se usa en |
|---|---|---|
| `content/destacados.json` | `{ "destacados": [{ "etiqueta": Texto, "ruta": string, "sprite": SpriteKey \| null }] }`, de 1 a 4. `ruta` sin idioma y con barra final (`"/pokedex/tiers/"`) | `FeaturedSection` (§8.1, §8.6, §8.12), grupo «Destacados» del menú (§8.0.3) |
| `content/mundos.json` | `{ "mundos": [{ "id": string, "nombre": string }] }`. `id` en kebab-case (`"titan-1"`); `nombre` es el del juego, igual en los dos idiomas (`"Titan 1"`). Orden: `nombre` con `Intl.Collator(locale, { numeric: true })` | `WorldsTable` (`nombre`, §8.1); filtro «Mundo» de Comercio (`id` en la URL, `nombre` visible, §9.5.4); `Anuncio.mundo` (`id`, §9.4); «Mundo» de publicar (§9.7.1); `create_guild` y `guilds.world_key` (`id`, §10.13); «Mundo:» de Guild (`nombre`, §10.5) |
| `content/elementos.json` | `{ "elementos": [{ "id": string, "nombre": Texto, "icono": SpriteKey \| null, "stone": string \| null, "fragment": string \| null }] }`. `id` de la tabla de §8.0.5 y en su orden; `stone` y `fragment`, `id` de ítem | `ElementChip`, `elementTip` (§7.5.3), filtros «Elemento», panel Pokédex del Inicio |
| `content/cambios.json` | `{ "cambios": [{ "id": string, "fecha": "AAAA-MM-DD", "titulo": Texto, "puntos"?: { "es": string[], "en": string[] }, "entidades"?: Ref[], "sprite"?: SpriteKey, "borrador"?: true }] }` | Cambios (§8.7) |
| `content/sistemas/<id>.json` | `{ "id", "titulo": Texto, "subtitulo"?: Texto, "sprite": SpriteKey \| null, "orden": integer, "tooltip": [{ "etiqueta": Texto, "valor": Texto }], "intro": Bloque[], "banner"?: { "sprite": SpriteKey \| null, "datos": { "es": string[], "en": string[] } }, "secciones": [{ "id", "titulo": Texto, "bloques": Bloque[] }], "borrador"?: true }`. `Bloque` = `{ "tipo": "parrafo" \| "subtitulo" \| "pasos" \| "tabla" \| "nota" \| "tarjetas" \| "chips" \| "lista", … }` con los campos de cada tipo de §8.4; el texto de un bloque es `{ "es": EnLinea[], "en": EnLinea[] }` y `EnLinea` = `string` \| `{ "ancla": string, "texto": string }` \| `{ "ruta": string, "texto": string }` \| `{ "entidad": Ref, "texto"?: string }` \| `{ "pd": integer }` \| `{ "dia": integer }` | Sistemas (§8.4), menú, Inicio, `systemTip`, Buscar |
| Objeto `moneda` de `content/items/diamantes.json` | `"moneda": { "seCompranEn": { "es": string[], "en": string[] }, "seUsanEn": { "es": string[], "en": string[] } }`, junto a `items` | `diamondsTip` (§7.5.3), hechos de anuncios de Diamonds (§9.5.8) |
| Pokémon: `hp`, `experiencia` (opcionales) | `integer \| null` | Ficha fija «HP:», «Experiencia:» (§8.3); Comparar «Otras» (§11.5) |
| Pokémon: `drops` (opcional) | `[{ "item": string, "cantidad": { "min": integer, "max": integer } \| null }]`; `item` es el `id` de un ítem de `content/items/` | Zona «Drops» de `DexCard` (§8.2); sección «Drops» de la ficha: su clave «Cantidad» muestra «{min}» o «{min} a {max}» / «{min} to {max}» (§8.3); «Drop de» de los ítems, que se calcula invirtiendo este campo (§7.5.3) |
| Pokémon: `evolucion` (opcional) | `[{ "a": string, "nivel": integer \| null, "items": [{ "item": string, "cantidad": integer }] }]`: evoluciones que salen de este Pokémon; `a` es el `id` destino. La primera etapa es la que ningún registro nombra en `a` | `EvolutionChain` (§8.3), filas de la Tier list de la ficha, Comparar |
| Pokémon: `habilidades` (opcional) | `string[]`, nombres del juego sin traducir (T23) | h3 «Habilidades» de «Ataques» (§8.3) |
| Pokémon: `donde` (opcional) | `{ "hunts": EnlaceDato[], "linkedTasks": EnlaceDato[], "equiposNpc": EnlaceDato[] }`; `EnlaceDato` = `{ "texto": string, "ref"?: Ref }`: con `ref` y registro es `NestedEntity`; sin él, texto | «Dónde encontrarlo» (§8.3) |
| Pokémon: `elementoMoveset` (opcional) | `id` de elemento o `null` | Columna «Moveset» de la Tier list de la ficha (§8.3) |
| Ítem: `elemento`, `uso` (opcionales) | `elemento`: `id` de elemento o `null`; `uso`: `Texto \| null` | «Elemento» y «Uso» de `LootCard`, `ListingCard` de Items e `itemTip` (§7.5.3, §8.5, §9.5.8) |
| Ítem de sistema: `sprite` (opcional) | `SpriteKey \| null` en cada entrada de `content/system-items.json` | `systemItemTip`, lista «Ítems» de la página de sistema (E16, §8.4.2) |
| Actividad: `sprite` (opcional) | `SpriteKey \| null` | Índice y banner de Actividades (§8.9) |
| Movimiento: `elemento` | pasa de texto («Normal») a `id` de elemento (`"normal"`) | Columna «Elemento» de «Ataques» (§8.3) |
| Textos de `quests.json` y `rotations.json` | cada texto pasa a `Texto`; mientras siga en inglés, se muestra con `lang="en"` en `es` (§8.8, §8.9) | Actividades, Tier list |
| `tests/fixtures/comercio/anuncios.json`, `tests/fixtures/comercio/vendedores.json` | §9.4. Solo se leen con `COMERCIO_DEMO=1` | Comercio, fase A (§9.2) |

**Claves de sprite fijas** que usa el código, además de las de §9.5.1 y de `ui/pokedolares`, `ui/diamond` y `ui/comercio/item`: `ui/inicio` (`HomeIntro`, §8.1); `ui/indice/sistemas`, `ui/indice/items`, `ui/indice/actividades` y `ui/indice/pokedex` (cabeceras de los paneles del Inicio, 24 px); `ui/herramientas/guild` y `ui/herramientas/mapa` (índice de Herramientas, §8.10); `ui/cambios` (nodo de un cambio sin sprite, §8.7). El menú lateral no tiene claves propias: solo «Destacados» lleva sprites y salen de `content/destacados.json` (§8.0.3). Estas claves las añade el propietario a `sprites.json` (D-011). El adaptador las resuelve con `spriteOrNull(clave)`: una clave fija que aún no existe da `null` (celda vacía en navegación, marca de sprite faltante en una entidad) sin fallar el build; cualquier otra clave inexistente sigue fallando el build (§7.4.1).

### 3.14 Pruebas de §3 (las ejecuta §14)

| ID | Prueba |
|---|---|
| V3-1 | El generador en modo `--check` sale con 0; `src/design/tokens.json` tiene los grupos del DS más `motion` y cada token con `name`, `value` y `usage` |
| V3-2 | En `/es/` calculado: `getComputedStyle(documentElement)` devuelve los 110 valores de `tokens.json` más los de §3.3; `--radius-12` es `12px` |
| V3-3 | Compilar `global.css` con `@tailwindcss/node`: `bg-primary`, `text-quinary`, `border-selected`, `shadow-ring-selected`, `rounded-11`, `type-tt-title`, `md:flex`, `xl:grid` generan CSS; `text-sm`, `font-bold`, `rounded-lg`, `shadow-sm`, `sm:flex`, `lg:flex`, `bg-red-500` no |
| V3-4 | `pnpm design:check` con 0 violaciones |
| V3-5 | `check-dist.mjs`: una hoja por página, ≤ 100.000 B, 0 URLs de Google Fonts |
| V3-6 | En la ficha de Pokémon y en el detalle del anuncio, exactamente 2 `link[rel=preload][as=font]` cuyos `href` coinciden con los `src` de las reglas `@font-face` de Poppins; en las demás páginas, 0. En `/es/` y `/es/pokedex/`, la consola no tiene avisos de precarga sin usar, y tras pasar el puntero por un disparador `document.fonts.check('600 12px Poppins')` es `true` |
| V3-7 | Una utilidad en `className` gana a la regla `ac-*` del componente sin fusionar clases: un `Button` con `className="rounded-12"` calcula `border-radius: 12px` (su clase `ac-button` fija `radius-11`) |

---

## 4. Tipografía y números

### 4.1 Estilos de texto

Son los únicos 22 estilos del sitio (`DS:tokens.type`), usados como `type-<estilo>` (§3.5) o `@apply type-<estilo>` en el CSS de componente.

| Utilidad | Tamaño / interlineado | Peso y extras | Familia | Uso |
|---|---|---|---|---|
| `type-h1` | 30 / 36 | 700 | sans | h1 de página, uno por página |
| `type-h1-sub` | 18 / 28 | 700 | sans | Subtítulo junto al h1 («(Máquina de Star)», «Nº 6») |
| `type-h2` | 20 / 28 | 700 | sans | h2 de sección |
| `type-h3` | 16 / 24 | 700 | sans | h3, h1 del Inicio, título de tarjeta informativa |
| `type-brand` | 18 / 28 | 700, −0,2 px | sans | Marca «Alliance Codex» en cabecera y hoja |
| `type-figure` | 18 / 28 | 700 | sans | Cifra de tarjeta KPI |
| `type-base` | 16 / 24 | 400 | sans | Base del documento (`body`) |
| `type-body` | 14 / 22 | 400 | sans | Párrafos, celdas, listas, botones, etiquetas de campo |
| `type-body-strong` | 14 / 22 | 700 | sans | Título de tarjeta, cabecera de grupo, pestaña con sprite, precio en dinero real |
| `type-note` | 14 / 22 | 400, cursiva | sans | Nota; su rótulo inicial en negrita |
| `type-field` | 14 / 20 | 400 | sans | Campos, selects, opciones, idioma de la cabecera |
| `type-fact-line` | 14 / 32 | 400 | sans | Líneas de dato con rótulo en negrita (cabecera de Guild, «Dónde encontrarlo») |
| `type-ui` | 12 / 16 | 400 | sans | Menú, hechos de tarjeta, chips, migas, TOC, conteos, banner, aviso, pie |
| `type-ui-strong` | 12 / 16 | 700 | sans | Grupo del menú, título de panel de índice, cabecera de tabla, toggles, página actual, cifra de pila |
| `type-ui-caps` | 12 / 16 | 700, 1,2 px, mayúsculas | sans | Solo «Destacados» del Inicio |
| `type-ui-step` | 12 / 16 | 700, cursiva | sans | Rótulo de paso en la línea de tiempo y título de ejemplo |
| `type-ui-featured` | 12 / 16,5 | 400 | sans | Etiqueta de tarjeta de Destacados, una línea con elipsis |
| `type-ui-loose` | 12 / 20 | 400 | sans | Listas de enlaces en una celda densa |
| `type-kbd` | 12 / 22 | 400 | mono | Keycap «Ctrl + K» |
| `type-tt-title` | 15 / 20 | 600, 0,35 em, mayúsculas | game | Nombre de la entidad en el tooltip, centrado con 0,35 em de relleno izquierdo |
| `type-tt-row` | 12 / 21 | 600, 0,03 em | game | Filas del tooltip, secciones plegables, tooltip compacto del gráfico |
| `type-tt-hint` | 12 / 16 | 500, 0,02 em | game | Franja «Mantén Shift para fijar» |

### 4.2 Reglas

- Ningún texto visible mide menos de 12 px (fuera de `sr-only`).
- Pesos: 400 y 700 en `sans`; 500 y 600 en `game`; 400 en `mono`. Toda negrita del marco es 700.
- Mayúsculas solo por `text-transform` en `type-ui-caps` y `type-tt-title`. El texto fuente queda en mayúscula inicial, así el lector de pantalla no deletrea.
- Los párrafos (`type-body`) van justificados a todo el ancho de su columna, sin `max-width` (`DS:README §Tipografía`, RUB §4). Justificar es regla de `DS:Section` y de la prosa de §7; `base.css` no lo impone a todo `p`.
- Poppins solo se calcula dentro de `[role="tooltip"]`, de las fichas fijas (Pokémon y anuncio) y del tooltip compacto del gráfico de Guild (S5, Q14). El oro (`tt-label`) y los demás `tt-*` siguen la misma frontera, salvo `tt-shiny` (R2).
- Una frase en inglés dentro de una página `es` lleva `lang="en"`; los nombres propios y los términos del juego no (T22, T23; §13).

### 4.3 Números

Todos los formateadores viven en `src/lib/format/`, con los nombres y ejemplos de §13.3 (`formatInteger`, `formatDecimal`, `formatPercent`, `formatSigned`, `formatPokedolares` y su texto para lector de pantalla, `formatDiamonds`, `formatRealMoney`, `formatRating`). El port de `formatKK`, `parseKK` y `formatThousands` de `bundle.js` (§7.8) se llama allí `formatPokedolares`, `parsePokedolares` y `formatInteger`. Ningún componente llama a `toLocaleString`, `toFixed` ni `Intl.NumberFormat` por su cuenta. Esta sección fija las reglas que todos comparten.

**Separadores (A8, `DS:guias/40`, `DS:guias/50`):**
- `es`: miles con punto y decimales con coma, también con cuatro cifras. Un solo formateador: `new Intl.NumberFormat('es-ES', { useGrouping: 'always' })`; sin `useGrouping: 'always'`, `es-ES` deja «1800» sin agrupar.
- `en`: `new Intl.NumberFormat('en-US')`.
- Salidas comprobadas con Node 22.16 (ICU 77): `es` «1.800», «57.960», «150.000.000», «2,5», «89,90»; `en` «1,800», «57,960», «150,000,000».
- Única excepción: la valoración lleva un decimal con punto en los dos idiomas («4.6», «5.0»; X5).

**Forma k/kk de los Pokédólares** (`formatPokedolares`, el algoritmo de `formatKK`), con aritmética entera (`BigInt`) para que los importes grandes no redondeen:
- menos de 1.000: el entero tal cual;
- de 1.000 a menos de 1.000.000: décimas de mil redondeadas mitad hacia arriba, sufijo «k»; si el redondeo llega a 1.000k, pasa a «1kk»;
- desde 1.000.000: décimas de millón redondeadas mitad hacia arriba, sufijo «kk»;
- un decimal como máximo, sin «,0» final; la parte entera se agrupa («1.200kk»);
- `parsePokedolares(texto, locale)` es el inverso, sin redondear (el `parseKK` de la referencia redondea con `Math.round`, `bundle.js:2548`; no se porta así). Devuelve `{ ok: true, valor: number }` o `{ ok: false, motivo: 'formato' | 'fraccion' | 'rango' }`:
  - acepta dígitos sin agrupar, dígitos agrupados con el separador de miles del idioma («1.500» en `es`, «1,500» en `en`) y una parte decimal con el separador decimal del idioma, seguidos de nada, «k» o «kk»: «150kk», «2,5k», «1.200kk», «850» en `es`; «150kk», «2.5k», «1,200kk», «850» en `en`;
  - calcula con enteros (`BigInt`) sobre los dígitos: parte entera y decimal por 1, 1.000 o 1.000.000 según el sufijo. Si queda una fracción de unidad («1,2345k», «2,5» sin sufijo), `motivo: 'fraccion'`;
  - `motivo: 'rango'` si el resultado es 0 o pasa de 999.999.999.999.999 (15 cifras, §9.4); `'formato'` para cualquier otro texto.

| Valor | `es` | `en` |
|---|---|---|
| 850 | 850 | 850 |
| 1.000 | 1k | 1k |
| 1.049 | 1k | 1k |
| 1.050 | 1,1k | 1.1k |
| 2.500 | 2,5k | 2.5k |
| 150.000 | 150k | 150k |
| 150.500 | 150,5k | 150.5k |
| 999.949 | 999,9k | 999.9k |
| 999.950 | 1kk | 1kk |
| 1.250.000 | 1,3kk | 1.3kk |
| 1.500.000 | 1,5kk | 1.5kk |
| 150.000.000 | 150kk | 150kk |
| 1.200.000.000 | 1.200kk | 1,200kk |

Todas las filas se comprobaron ejecutando `formatKK` de `bundle.js`.

**Reglas comunes:**
- Un valor desconocido (`null` o `undefined`) devuelve «—» (U+2014) en todo formateador; nunca «0» ni «N/D». Un importe desconocido se pinta «—» sin sprite (`DS:PokedolaresAmount`). En el tooltip la fila se omite (T32).
- El texto visible de un importe de Pokédólares es la forma k/kk con `aria-hidden="true"`; el nombre accesible es la cifra exacta agrupada con la moneda («150.000.000 Pokédólares»; R5).
- Signo negativo: siempre U+2212 «−», también donde `Intl` devolvería el guion U+002D. Las variaciones llevan signo siempre («+12,0%», «−8,4%»).
- Porcentaje: cifra y «%» sin espacio («53%»), también en `es`, donde `Intl` con `style: 'percent'` pondría un espacio: no se usa `style: 'percent'`.
- Los identificadores no son cantidades y no se agrupan: número de Pokédex («Nº 6»), id del cliente, año, coordenadas («x 1721, y 2158, piso 7»), número de Linked Task («n.º 19»).
- «KKs», «KK» y «gold» no existen en la interfaz (R5).

### 4.4 Fechas y horas

Opciones de `Intl.DateTimeFormat` sobre las que se construyen los formateadores de fecha de §13.3 (`formatServerTime`, `formatWeekday`, `formatDateRange` y `formatRelative` incluidos):

| Formateador | `es` (`'es-MX'`) | `en` (`'en-US'`) |
|---|---|---|
| `formatDate` | `{ day: '2-digit', month: '2-digit', year: 'numeric' }` → «18/09/2026» | `{ month: 'short', day: 'numeric', year: 'numeric' }` → «Sep 18, 2026» |
| `formatDateTime` | lo anterior más `{ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }` → «18/09/2026, 14:32» | lo anterior más `{ hour: 'numeric', minute: '2-digit' }` → «Sep 18, 2026, 2:32 PM» |
| `formatTime` | `{ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }` → «14:32» | `{ hour: 'numeric', minute: '2-digit' }` → «2:32 PM» |
| `formatDayMonth` | `{ day: '2-digit', month: '2-digit' }` → «18/09» | `{ month: 'short', day: 'numeric' }` → «Sep 18» |

- Salidas comprobadas con Node 22.16 para 2026-09-18 17:32 UTC con `timeZone: 'America/Sao_Paulo'`.
- `hourCycle: 'h23'` es obligatorio en `es`: `es-MX` usa 12 h por defecto.
- Los datos del juego (Server Save, días y semanas de Guild) se calculan en `America/Sao_Paulo` y la hora se nombra «(hora de Brasilia)» (A12, §13.3).

### 4.5 Cifras tabulares

`font-variant-numeric: tabular-nums` (utilidad `tabular-nums` o la regla del componente, como en `bundle.css`) en: celdas numéricas de `DataTable`, conteos, `PokedolaresAmount`, `DiamondsAmount`, precios en dinero real, cifra de KPI, cifra de pila, números de `Pagination`, ejes del gráfico y `Rating`.

### 4.6 Qué sustituye

Estos formateadores actuales se sustituyen por los de `src/lib/format/` cuando §9 y §10 rehacen sus pantallas:
- `src/lib/trade/draft.ts:18-32`: `formatWhole` (`en-US` en ambos idiomas), `compactKks` (solo múltiplos exactos) y `formatPokedolares` («1,000,000 (1kk)»). La forma «entero (k)» desaparece. `compactKks` se conserva solo para el texto copiado de §9.7.7 (E12).
- `src/lib/tools/guild-ranking.ts`: `:565-566` (`formatGuildNumber`, `pt-BR` por defecto); `:569-574` (`formatGuildExportDate`, `pt-BR` por defecto) y `:609` (la llama con `es-ES`); `:703`, `:718`, `:734`, `:757` y `:812` (`es-ES` sin `useGrouping: 'always'`: «1800»); `formatGuildGoalSet` (`:900`, `pt-BR` por defecto, `:922`).
- `src/lib/time/server-save.ts:46-58` (`es-MX` con `dateStyle: 'medium'`).

### 4.7 Pruebas de §4 (las ejecuta §14)

| ID | Prueba |
|---|---|
| V4-1 | Pruebas unitarias de `src/lib/format/`: cada fila de la tabla k/kk de §4.3 en `es` y `en`; «1.800», «57.960», «2,5» / «1,800», «2.5»; «4.6» en ambos idiomas; «53%» sin espacio; «−8,4%» con U+2212; «—» para `null` |
| V4-2 | `numbers.test.ts`: `parsePokedolares(formatPokedolares(n))` devuelve `n` redondeado a la décima mostrada, para 20 valores entre 1 y 10^12; «1,2345k» y «2,5» dan `fraccion` en `es`; «1.500» da 1500 en `es` y «1,500» da 1500 en `en`; «0», «abc» y 16 cifras dan `rango` o `formato` |
| V4-3 | Pruebas de fechas: compara cada formateador de §4.4 con el mismo `Intl.DateTimeFormat` construido en la prueba (no con literales, porque la salida exacta cambia con la versión de ICU) y verifica literalmente el orden día/mes en `es` y el reloj de 24 h |
| V4-4 | e2e: en todas las rutas, 0 elementos visibles con `font-size` calculado < 12 px; cada par tamaño/interlineado calculado está entre los 22 de §4.1 (S5) |
| V4-5 | e2e: `getComputedStyle(body).fontFamily` empieza por `Verdana`; `fontFamily` de todo elemento con Poppins calculada tiene un ancestro `[role="tooltip"]`, una ficha fija (Pokémon o anuncio) o el tooltip del gráfico |
| V4-6 | Sentinela de §12: el formateo con `toLocaleString(`, `.toFixed(` o `new Intl.NumberFormat(` solo aparece en `src/lib/format/` |

---

## 5. Forma, espaciado, puntos de corte y marco

### 5.1 Radios, bordes y profundidad

| Radio | Dónde (`DS:tokens.radius`) |
|---|---|
| `radius-12` | Tarjetas, paneles de índice, búsquedas, notas, tarjetas informativas, panel de Slots, avisos, campo numérico, diálogos |
| `radius-11` | Botones bordeados, campos, selects, paginación, botones de icono, tarjeta KPI |
| `radius-10` | Botón sólido |
| `radius-8` | Tablas, enlaces del menú, pestañas y toggles, slots y escenarios, listado de select, popover «+N», banner, keycap |
| `radius-6` | Enlace de panel de índice, held slot de 32, botón de orden de cabecera |
| `radius-4` | Tooltip del juego, foco de enlaces anidados, barras del gráfico (4 4 0 0), cuadro de carga |
| `radius-3`, `radius-2` | Marca de sprite faltante; opción de select y cuadros de la marca Shiny |
| `radius-full` | Solo chips, chip de elemento, botón «+N» y medidor de entrenamiento. Un botón nunca es una píldora |

- Bordes siempre de 1 px: `border-secondary` por defecto (decorativo, 1,28:1); `border-primary` en botones, pestañas, toggles sin seleccionar y campo numérico.
- Sin sombras de elevación, degradados ni brillo (R1, S6). La profundidad sale de `bg-primary`, `bg-secondary` y `bg-tertiary` con bordes de 1 px. Las únicas sombras son `ring-selected`, `inset-missing`, `inset-tt-empty` y `text-shadow-game`.
- Una tarjeta no se desplaza ni escala en hover.

### 5.2 Estados

| Estado | Regla | Dónde |
|---|---|---|
| Hover | Fondo `bg-tertiary`, el único color de hover. Excepciones: fila de Lista `bg-secondary`; opción de select `bg-quaternary`; enlace de texto solo subraya | Todo lo interactivo |
| Foco | `outline: 2px solid var(--ring)`, `outline-offset: 1px`, en todo lo enfocable, campos incluidos (`base.css`). Nunca `outline: none` sin sustituto | Todo |
| Selección | Borde 1 px `selected` + `shadow-ring-selected` (2 px en total), fondo transparente. El ámbar nunca marca un enlace | Toggles, pestañas, `ViewToggle`, aura |
| Actual | Fondo `bg-tertiary` y `aria-current="page"`; en el TOC solo `text-primary` y `aria-current="location"` | Menú, paginación, TOC |
| Deshabilitado | Texto `text-quaternary`, borde `border-secondary`, `cursor: not-allowed` | Botones y campos |
| `forced-colors: active` | La sombra del segundo píxel desaparece: la selección pasa a `border: 2px solid Highlight`; el foco conserva su `outline` | `base.css` |

Los pares por debajo del mínimo que el DS conserva (el anillo `ring` sobre `bg-secondary`, `tt-panel` y `bg-tertiary`; `border-primary` como borde de control; `text-quaternary` sobre `bg-tertiary` solo en el disparador de búsqueda en hover; la barra del día en curso a `opacity-partial`) se aceptan tal cual (`DS:README §Color`, S12).

### 5.3 Espaciado

- Solo los 12 pasos de `DS:tokens.spacing`: 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40 y 48. Con `--spacing: 1px`, el número de la utilidad es el paso (`p-16`, `gap-6`); `design:check` rechaza otro número en utilidades de espacio (`p-13`), aunque Tailwind lo compile.
- Anchos y altos fijos: tokens `layout-*`, `size-*` y `grid-*` con la sintaxis `w-(--token)`, o `100%`, `auto` y las palabras clave de Tailwind (`w-full`, `h-dvh`).
- Ritmos principales: tarjeta, nota, banner y panel de Slots con relleno `space-16`; zonas de tarjeta a `space-12`; hechos a `space-6`; rejillas a `space-16` (menos en teléfono, `CGS §4`); bloques de página interior a `space-48`; bloques del Inicio a `space-24`.

### 5.4 Puntos de corte

| Tipo | Umbral | Qué cambia | Sintaxis |
|---|---|---|---|
| Ventana | 768 (`layout-bp-md`) | Desde aquí la cabecera de páginas interiores muestra el disparador de búsqueda centrado; por debajo, un botón de lupa de 44. `FilterBar` apila sus filtros por debajo | `md:` / `@media (width >= 48rem)`; `max-md:` / `(width < 48rem)` |
| Ventana | 1280 (`layout-bp-xl`) | Desde aquí barra lateral, rail o espaciador, sin márgenes laterales; por debajo, hoja de menú y márgenes de 16 | `xl:` / `(width >= 80rem)`; `max-xl:` / `(width < 80rem)` |
| Componente | 1024 | `InfoBanner`: por debajo, los datos se apilan a 8 y se ocultan los «\|» | Solo en `info-banner.css`, `(width < 64rem)` |
| Componente | 576 | `Breadcrumb`: por debajo, 6 entre migas | Solo en `breadcrumb.css`, `(width < 36rem)` |
| Componente | 460 | `PageTitle`: por debajo, se oculta el subtítulo | Solo en `page-title.css`, `(width < 28.75rem)` |
| Contenedor | Por familia | Columnas y separación de cada rejilla de tarjetas (`CGS §4`, `DS:guias/30`), y la anatomía compacta de Pokédex bajo `grid-compact` (240) | `@container` en `card-grid.css` (§7) |

- Los umbrales en `rem` (÷ 16) siguen al tamaño de letra del usuario: con letra base mayor, el marco de teléfono aparece antes.
- La sintaxis de rango evita el hueco de `max-width: 1279px` / `min-width: 1280px` con anchos fraccionarios.
- `bundle.css` usa `max-width` (1023.98, 1279, 767, 575, 459 px); al portar se reescriben con la tabla.

### 5.5 Marco a 1440

- Con rail («Resumen»): barra lateral x 0–208 · 40 · columna principal x 248–1144 (896) · 40 · rail x 1184–1440 (256).
- Sin rail: barra lateral x 0–208 · 40 · columna principal x 248–1192 (944) · 40 · espaciador x 1232–1440 (208).
- Cabecera en y 0–64; el contenido empieza en y = 96 (64 + 32).

Fila del marco: `display: flex; justify-content: space-between; gap: var(--layout-gap)`, `padding-top: var(--space-32)`. La columna principal es `flex: 1; min-width: 0; max-width: var(--layout-main-max)`; 896 y 944 son su ancho a 1440, no un ancho fijo. Toda página sin rail termina en x = 1192 (`CGS §3`).

| Ventana | Barra lateral | Columna principal con rail | Sin rail (espaciador) | Rail |
|---|---|---|---|---|
| 390 | hoja | 16 / 358 | 16 / 358 | — |
| 768 | hoja | 16 / 736 | 16 / 736 | — |
| 1024 | hoja | 16 / 992 | 16 / 992 | — |
| 1280 | 0 / 208 | 248 / 736 | 248 / 784 | 1024 / 256 |
| 1440 | 0 / 208 | 248 / 896 | 248 / 944 | 1184 / 256 |
| 1920 | 0 / 208 | 248 / 1376 | 248 / 1424 | 1664 / 256 |

(x / ancho, en px; RUB §1.1 y `CGS §3`.) Qué páginas llevan rail lo fija §8: sistemas y ficha de Pokémon con rail; Inicio, Pokédex, Comercio y Guild sin él (`DS:PageLayout`).

### 5.6 Cabecera

- `position: sticky; top: 0; z-index: var(--z-header)`; alto `layout-header` (64), relleno 0 16, borde inferior `border-secondary`, fondo `bg-primary` opaco, sin `backdrop-filter`.
- Izquierda: la marca «Alliance Codex» (`type-brand`), enlace a `/{locale}/`. No hay logotipo gráfico.
- Centro (páginas interiores, desde 768): `SearchTrigger` de 448 × 40 (`layout-search`, radio 12) con «Buscar...» y el keycap «Ctrl + K», centrado de forma absoluta. El Inicio no lo lleva: su buscador está en el cuerpo (A3).
- Derecha desde 1280: selector de idioma de 192 × 40 (globo 16, idioma, chevron 16). La cabecera termina ahí (X2): el separador y el botón de tema no se renderizan mientras Q6 no traiga un tema claro.
- Por debajo de 1280: separador de 1 × 16 y botón de menú de 44 × 44; por debajo de 768 y en páginas interiores, la lupa de 44 va antes del separador. El idioma se mueve a la hoja (§5.8).
- Detalle de marcado, nombres accesibles y comportamiento: `DS:Header` y §7.

### 5.7 Barra lateral y rail

- Solo desde 1280. Barra lateral de `layout-sidebar` (208), relleno 0 16 16 (176 útiles). Rail de `layout-rail` (256) con relleno derecho 16 (240 útiles, `layout-rail-content`) y bloques a `space-32`. Sin rail, un espaciador vacío de `layout-spacer` (208) con `aria-hidden="true"`.
- Las dos columnas son `position: sticky; top: calc(var(--layout-header) + var(--space-32))`. La barra lateral tiene desplazamiento propio: `max-height: calc(100dvh - var(--layout-header) - var(--space-32))`, `overflow-y: auto`, `overscroll-behavior: contain` (`DS:PageLayout`).
- Posición del desplazamiento de la barra lateral entre páginas: un listener `pagehide` guarda su `scrollTop` en `sessionStorage` (`ac:sidebar`); un script en línea colocado justo después de la barra lateral lo restaura antes de la primera pintura. Lecturas y escrituras dentro de `try/catch`; si fallan, empieza arriba.
- Contenido y estados de la barra lateral (grupos, «Destacados» con sprites de 16 que rebotan, página actual): `DS:Sidebar` y §7. Contenido del rail: `DS:Toc` y §7.

### 5.8 Teléfono (390) y hoja de menú

Según `Lienzo:Inicio-movil`:
- Cabecera de 64: marca a la izquierda; a la derecha, lupa de 44 (solo en páginas interiores), separador y menú de 44.
- Contenido con márgenes de `space-16` (358 útiles a 390), `padding-top` 32. Ritmo de bloques 48 en páginas interiores; 16 en el Inicio, con 48 sobre el pie (16 de separación más 32 de margen).
- Todo objetivo táctil mide `size-touch` (44) en la cabecera, la hoja, la búsqueda, los slots y las filas de índice; el resto de reglas de `pointer: coarse` las fija cada componente (§7, S14).

Hoja de menú (`DS:MobileMenu`; marcado y script en §7.10.3):
- `<dialog id="menu-movil">` abierto con `showModal()`, sin React: el resto de la página queda inerte, Escape cierra (evento `cancel`) y el foco vuelve al botón de menú.
- Hoja de `layout-sheet` (288) pegada al borde derecho, alto `100dvh`, fondo `bg-primary`, borde izquierdo `border-secondary`, sobre el velo `overlay` con `backdrop-filter: blur(4px)`.
- Si el velo se pinta en `::backdrop` (§7.10.3), `var(--overlay)` exige que `::backdrop` herede las propiedades personalizadas del documento; V5-4 comprueba el color calculado del velo en Chromium y WebKit.
- Con la hoja abierta la página no se desplaza (`html:has(#menu-movil[open]) { overflow: hidden }`). Desde 1280 la hoja no existe; si está abierta al ensanchar la ventana, se cierra.
- Movimiento: §6.2.

### 5.9 Pie y orden de página

- Orden de una página interior (`DS:README §El marco`): migas → título (h1, subtítulo y divisor) → banner de datos si aplica → secciones (h2, divisor y contenido a `space-16`) → pie. Bloques a `space-48`; 24 bajo la columna principal.
- Pie (`DS:Footer`): última pieza de la columna principal, una línea `type-ui` en `text-tertiary`, borde superior de 1 px `border-secondary`, relleno 16 0, con el texto de A5.
- Saltos a una sección: `html` reserva la cabecera fija con `scroll-padding-top: var(--layout-header)` (§3.6) y `Section` añade su `scroll-margin-top` de 16 (§7.11), así el h2 queda 16 px bajo la cabecera, como en RubinOT (16 px bajo el borde de su zona de desplazamiento). El scroll-spy del TOC (§7.11) mide con el mismo umbral: 64 + 16 = 80 px desde el borde de la ventana.

### 5.10 Pruebas de §5 (las ejecuta §14)

| ID | Prueba |
|---|---|
| V5-1 | Marco a 1280, 1440 y 1920 × 900 en una página con rail y otra sin él: x y ancho de barra lateral, columna y rail de la tabla de §5.5 (±1 px); a 390, 768 y 1024: columna en 16 con 358, 736 y 992 de ancho, sin barra lateral ni rail, 0 desbordamiento horizontal (S1) |
| V5-2 | Tras desplazar 2.000 px: la cabecera sigue en y = 0; a 1440, la barra lateral y el rail en y = 96 |
| V5-3 | Pulsar un enlace del TOC deja el `top` del h2 de destino en 80 ± 1 px (cabecera de 64 + 16) y su enlace con `aria-current="location"` |
| V5-4 | A 390, en Chromium y WebKit: abrir la hoja con el botón de menú; el foco entra en la hoja; Tab no sale de ella; Escape la cierra y el foco vuelve al botón; con la hoja abierta, `scrollY` no cambia al girar la rueda; el velo calcula el color de `overlay` (`rgba(0, 0, 0, 0.8)`) y `backdrop-filter: blur(4px)` |
| V5-5 | A 1440 y 390: la cabecera no contiene un botón de tema ni un elemento `aria-hidden` con aspecto de control (X2, S11) |
| V5-6 | Barra lateral desplazada 300 px, navegar a otra página: la barra lateral nueva conserva `scrollTop` 300 ± 1 |
| V5-7 | `design:check` regla 5 (umbrales) y regla 4 (longitudes) en verde |

---

## 6. Movimiento

### 6.1 Navegación entre documentos

Navegación nativa entre documentos, sin `<ClientRouter />` y sin view transitions (T4): el DS no define transiciones de página y §6.2 es todo el movimiento del sitio. Las páginas prerenderizadas no cambian y las islas no se remontan a mano.

- Se borran el `@view-transition` y el grupo de 220 ms de `wiki-reference.css:1549-1556`, el movimiento reducido de 1 ms de `:2899-2903` y los nombres de transición por tarjeta y por ficha de `PokedexGrid.tsx:293`, `:316` y `[slug].astro:68`, `:99`. Ningún elemento lleva `view-transition-name` y ninguna hoja declara `@view-transition`.
- `astro.config.mjs` añade `prefetch: { prefetchAll: false, defaultStrategy: 'hover' }`; los enlaces del menú lateral y de las listas de entidades llevan `data-astro-prefetch`. Una isla que crea enlaces después de cargar (filtros, paginación) llama a `prefetch(href)` de `astro:prefetch` en `pointerenter` y `focus`. Así la navegación no espera a la red.

### 6.2 Inventario de movimiento

Todo el movimiento del sitio. Nada fuera de esta tabla se anima (A21, T24).

| Elemento | Movimiento | Duración y curva | Con movimiento reducido |
|---|---|---|---|
| Hover de enlaces del menú, botones, disparadores, tarjetas, chips, slots, filas | `background-color` (y `color` donde el componente lo cambia) | `duration-fast`, `ease-standard` | Cambio instantáneo |
| Entrada del tooltip del juego, del listado de `Select`, del popover «+N» y del tooltip del gráfico de Guild (los cuatro usos de `bundle.css`) | `@keyframes ac-tt-in`: de `opacity: 0; transform: translateY(4px) scale(0.95)` a su estado final. Sin animación de salida | `duration-fast`, `ease-standard` | Aparece sin animación |
| Velo de la hoja móvil y de la paleta de búsqueda | `@keyframes ac-fade` (opacidad 0 → 1) | `duration-fast`, `ease-standard` | Sin animación |
| Hoja móvil | `@keyframes ac-sheet-in` (de `translateX(100%)` a 0). Sin animación de salida (el DS no la define) | `duration-sheet`, `ease-standard` | Sin animación |
| Flecha de `FeaturedCard` | En hover, `translateX(var(--space-2))` y color `text-tertiary` | `duration-fast`, `ease-standard` | Solo el color, instantáneo |
| Cuadro de carga de un sprite | `@keyframes ac-pulse` (opacidad 0,5 al 50 %), infinita | `duration-pulse`, `ease-pulse` | Quieto |
| Sprite al terminar de cargar | `ac-fade` | `duration-sprite-in`, `ease-standard` | Aparece sin fundido |
| Sprites de Destacados y del grupo «Destacados» del menú | `@keyframes ac-bounce`: sube 3 px al 25 % y al 75 %, infinita. Empieza de nuevo en cada página | `duration-bounce`, `ease-bounce` | Quietos |
| Diamond y demás sprites `animacion` | Fotogramas del registro (§6.3) | `duracionMs` de `sprites.json`, `steps(1, end)` | Fotograma 0 |
| Desplazamiento a un ancla | `scroll-behavior: smooth` | La del navegador | `auto` |

- Chevrones de grupos y de secciones plegables: cambian de dirección sin animación (`DS:Sidebar`; `bundle.css` no los anima).
- Las `@keyframes` viven en `motion.css` con los nombres de `bundle.css` (`ac-bounce`, `ac-tt-in`, `ac-pulse`, `ac-fade`, `ac-sheet-in`); los componentes las usan desde su archivo de `src/styles/components/`.
- Solo se animan `opacity`, `transform`, `background-color`, `color` y el `object-position` de los sprites por pasos.

### 6.3 Diamond y hojas animadas

- El Diamond (`ui/diamond`: 7 fotogramas de 32 × 32, 110 ms cada uno, 770 ms por vuelta) y cualquier otra entrada `modo: "animacion"` de `sprites.json` se animan con las `@keyframes` que `SpriteStyles.astro` genera en el build desde el registro (§3.12, §7.4.2): `object-position` por fotograma con `steps(1, end)`, que equivale al `step-end` del DS. Cambiar `duracionMs` o el número de fotogramas en el registro cambia la animación sin tocar código.
- Se anima solo con la animación activada en `Sprite` (en `DiamondsAmount`, `animated` y `tipAnimated`, §7.8) y solo donde lo pide `DS:guias/40`: escenario y cabeza del tooltip de un anuncio de Diamonds, pestaña y grupo «Diamonds» de Comercio, Destacados y banner de Comercio.
- Quieto en el fotograma 0: delante de un importe (`DiamondsAmount`) y en el menú lateral, donde se dibuja reducido a 16 px con `half` (0,5x, la única reducción de un sprite de píxel, R11).
- La animación empieza en el fotograma 0 cada vez que el elemento se inserta (nueva página, tooltip abierto de nuevo).

### 6.4 Movimiento reducido

Con `prefers-reduced-motion: reduce` no se anima nada, sin usar `!important` (T6):
- Toda declaración `animation*` y `transition*` del sitio vive dentro de `@media (prefers-reduced-motion: no-preference)`: en `motion.css`, en cada archivo de `src/styles/components/` y en las `@keyframes` de sprites (hoy `resolve.ts:179`; §7.4.2 lo conserva). `design:check` regla 7 lo verifica.
- En clases, `transition*`, `animate-*` y `duration-*` solo con `motion-safe:` (`design:check` regla 6).
- `scroll-behavior: smooth` solo dentro del bloque (`base.css`).
- JavaScript: cualquier animación por script consulta `matchMedia('(prefers-reduced-motion: reduce)')` antes de empezar, como ya hace `src/components/wiki/OutfitPreview.tsx:178` y `:194` con el aura.
- `bundle.css` resuelve lo mismo con `animation: none !important; transition: none !important` sobre las clases `ac-*`; esa regla no se porta.

### 6.5 Soporte de navegadores

Todo es mejora progresiva: sin soporte, nada se rompe.

| Capacidad | Sin soporte |
|---|---|
| `popover` y `popovertarget` | `PlusN` y el selector de idioma necesitan un respaldo con script (§7) |
| `<dialog>` con `showModal()` | Todos los navegadores de destino lo tienen |
| `:has()` para bloquear el desplazamiento con la hoja abierta | La página se desplaza detrás del velo; la hoja sigue siendo modal |
| `@container` | Todos los navegadores de destino lo tienen (§7) |

### 6.6 Pruebas de §6 (las ejecuta §14)

| ID | Prueba |
|---|---|
| V6-1 | Chromium, sin preferencia: al ir de `/es/` a `/es/pokedex/`, `pagereveal` recibe `viewTransition === null` y ningún elemento de la página nueva calcula `view-transition-name` distinto de `none` (T4) |
| V6-2 | Con `reducedMotion: 'reduce'`: 50 ms después de abrir un tooltip, la hoja móvil y un popover «+N», `document.getAnimations().length === 0`; el Diamond animado calcula `animation-name: none` y su `object-position` es el del fotograma 0; `scroll-behavior` es `auto` (S15) |
| V6-3 | Sin preferencia: el Diamond animado calcula `animation-duration: 0.77s` y `animation-timing-function: steps(1)` (forma serializada de `steps(1, end)`); el Diamond del menú y el de `DiamondsAmount` calculan `animation-name: none` |
| V6-4 | `grep`: 0 `@view-transition`, 0 `view-transition-name` y 0 `viewTransitionName` en `src/` |
| V6-5 | Cada duración y curva calculada de §6.2 coincide con su token (`transition-duration: 0.15s` en el hover de un botón, `animation-duration: 0.5s` en la hoja) |

---

## 7. Componentes

Esta sección fija, para cada componente del DS, el archivo del sitio que lo implementa, cómo se renderiza (Astro estático, TSX de servidor o isla y su directiva), sus props, qué reemplaza del código actual y, con detalle, el comportamiento de las piezas interactivas. Referencias como en «Cómo leer este documento»; además, «la referencia» es la implementación del DS en `components/bundle.js` y `components/bundle.css`, e `index.d.ts` es `components/index.d.ts`.

### 7.1 Reglas comunes

**C-R1 Formato de archivo.**
- `.astro`: componentes que solo aparecen en el marco o en contenido estático de una página y nunca dentro de una isla (columna «Render» = Astro en 7.2). Una isla React no puede renderizar un `.astro`.
- `.tsx` de servidor: componentes que pueden aparecer dentro de una isla. Por eso son TSX `Breadcrumb` y `PageTitle` (la isla de Guild cambia la miga actual y el h1, §10.5), `Section` (la cuenta de §9.9 y los diálogos de §10.10 son islas), `FeaturedCard`, `FeaturedSection` e `IndexLinks` (la isla de Buscar los pinta, §8.6). Desde una página `.astro` se usan sin directiva `client:*`: Astro los convierte en HTML en el build y no envía JS. Dentro de una isla se reutilizan tal cual. Ningún componente tiene dos implementaciones.
- Isla: solo un bloque con estado del usuario (una lista, la paleta de búsqueda, una herramienta) lleva directiva, siempre como una raíz por bloque y nunca una isla por componente. Inventario en 7.3.
- Comportamiento sin React: módulos `src/scripts/*.ts` que `src/layouts/PageLayout.astro` importa una vez con `<script>` de Astro (módulo diferido y deduplicado). Actúan por delegación sobre atributos `data-ac-*`, así atienden igual al HTML estático y al que pinta una isla.
- Las props de una isla son serializables (Astro no pasa funciones a una isla). Por eso cada lista tiene su raíz de isla propia (7.7.1).

**C-R2 Marcado y CSS.** Cada componente reproduce la estructura DOM, los atributos ARIA y las clases `ac-*` de la referencia, así el CSS portado de `bundle.css` aplica sin cambios. Dónde vive ese CSS y en qué capa: §3.6–§3.7. Solo hay estilos en línea para valores que dependen de datos: `grid-row: span Z` de una tarjeta, la posición y el alto máximo calculados de un tooltip o popover y `left`/`top` de un sprite en su celda.

Excepciones de marcado, todas porque el sitio no hidrata React en el marco ni en el HTML estático (§3.8). Cada una conserva las clases `ac-*` de las partes que no cambia; el CSS portado se ajusta al elemento nuevo en el mismo archivo del componente:

| Componente | Referencia (`bundle.js`) | Sitio | Motivo |
|---|---|---|---|
| `Sprite` | `span` con hoja desplazada y keyframes escritas en el cliente | `<img class="ac-sprite">` con `object-position` (7.4.2) | Keyframes en el HTML prerenderizado (E9) |
| `Sidebar`, grupos plegables | `button.ac-sidebar__toggle` con `aria-expanded` y `ul[hidden]` (`:308-313`) | `<details>` con `<summary class="ac-sidebar__toggle">` y el `ul` (7.10.2) | Pliega sin JS |
| `GameTooltip`, secciones | `button.ac-game-tooltip__toggle` con `aria-expanded` (`:2063`) | `<details open>` con `<summary>` (7.5.2) | Pliega sin JS y dentro de HTML estático |
| `MobileMenu` | `div` con `role="dialog"` y foco atrapado por script (`:348-409`) | `<dialog id="menu-movil">` con `showModal()` (7.10.3) | Modal nativo sin React |
| `Header`, idioma | botón con `aria-haspopup="listbox"` sin lista propia (`:115-119`) | `LanguageMenu`: botón con `popovertarget` y lista `popover="auto"` de dos enlaces (7.10.1) | Enlaces reales, sin React |
| `Header`, tema | botón de tema y su separador | no se pintan (X2) | Control falso (R12) |
| `NestedEntity` | panel `span.ac-nested-entity__pop` con `hidden` dentro del envoltorio (`:2355-2360`) | panel `GameTooltip` hermano del disparador con `role="tooltip"`, `id` y `popover="manual"` (7.5.1) | Capa superior sin recorte y controlador sin React |
| `PlusN` | `ul[hidden]` (`:2912`) | `ul[popover="manual"]` (7.5.8) | Ídem |
| `Select` | `ul[role="listbox"]` que solo existe abierto (`:1032`) | `ul[role="listbox"][popover="manual"]` siempre en el DOM (7.2.2) | Ídem |

**C-R3 Props.** Las de `index.d.ts`, con estas diferencias globales y las particulares de 7.2:
- **DP1 Textos.** Todo texto visible de un componente llega por props; ningún componente importa un diccionario ni elige textos por `locale`. Quien compone los pasa: el frontmatter de la página o la raíz de la isla, que los toma del espacio de nombres `ui` (textos propios de los componentes: franja del tooltip, vistas, paginación, cerrar, aviso; §13.2) y del espacio de su página para el resto. Una isla recibe solo `ui` y su espacio (§13.2), así su chunk no lleva el otro idioma. Los valores `es` de `ui` son los por defecto del DS; los `en`, los que cada README del DS indica para el locale en. La prop `locale` solo elige el formato de números y fechas.
- **DP2 Sprites.** Como en el DS: `SpriteProps` con URL y datos del fotograma (R7). Quien arma los datos (el frontmatter de la página o la raíz de la isla) obtiene esas props con el adaptador (§3.12, 7.4.1) a partir de la clave de `public/sprites/sprites.json`. Ningún componente importa `sprites.json` directamente ni escribe una URL de sprite. Los únicos componentes que llaman al adaptador por su cuenta son `PokedolaresAmount`, `DiamondsAmount` y `PriceOptions`, para las claves fijas `ui/pokedolares` y `ui/diamond` (el `AC.assets` del DS). `null` significa entidad conocida sin sprite.
- **DP3 Tooltips.** Donde el DS recibe `tip?: GameTooltipProps` (nodos React), el sitio recibe `tip?: TipData` (datos serializables, 7.5.2). No existen `open`, `defaultOpen` ni `onOpenChange` en ningún disparador ni popover: el estado es del controlador (7.5.4).
- **DP4 Manejadores del marco.** `onLanguage`, `languageOpen`, `onToggleTheme`, `themeLabel`, `onMenu`, `menuOpen` y `onOpen` no existen. Los sustituyen atributos que atienden los scripts de 7.9 a 7.11.
- **DP5 Props de vista previa.** No se implementan: `SkipLink.visible`, `Header.mobile`, todos los `defaultOpen`, `BarChart.defaultOpenDay`.
- **DP6 Props sin uso en el lienzo.** No se implementan `CardGrid.columns` ni `CardGrid.gap` (las columnas salen del contenedor, 7.6.1). El token `layout-main-full` no tiene componente (ninguna pantalla lo usa).

**C-R4 IDs.** `useId()` de React. Es único por página porque `@astrojs/react` 6.0.5 da a cada raíz React, estática o isla, un `identifierPrefix` propio por página y lo repite al hidratar (`node_modules/@astrojs/react/dist/server.js:51-55,89`, `node_modules/@astrojs/react/dist/client.js:78`). Son fijos los ids que otro archivo necesita: `contenido`, `menu-movil`, `buscar-dialogo`, el `id` de cada `Section` y los `anchorId` de las listas (`item-{id}`, 7.7.3 H7).

**C-R5 Controles reales y datos.** Un control sin acción no se renderiza (botón, chevron, keycap, glifo). Ningún componente muestra procedencia, estado de verificación de datos ni texto meta (R6, R12). «—» solo en hechos de tarjeta y celdas de tabla; en el tooltip la fila se omite. Una mención sin registro de entidad es texto plano (R2).

**C-R6 Movimiento.** Rebote, Diamond, entrada del tooltip, hoja, velo, pulso de carga y fundido se desactivan con `prefers-reduced-motion: reduce`; los sprites quedan en el fotograma 0 (S15).

**C-R7 Glifos.** Los únicos SVG son los glifos utilitarios de `DS:README §Iconografía`, a través de `src/components/icons/Glyph.tsx`: `name` ∈ {`search`, `chevron-down`, `chevron-up`, `chevron-right`, `globe`, `menu`, `close`, `arrow-right`, `check`, `sort`, `sort-up`, `sort-down`}, `size` (12, 14, 16 o 18), trazo 2 (2,5 a 12 px), `currentColor`, `aria-hidden="true"`. Dibuja los iconos de lucide-react (R17). Ningún otro archivo importa `lucide-react`. `moon` no está en la lista mientras no exista tema claro (X2, Q6).

### 7.2 Inventario

Rutas bajo `src/`. «Render»: **Astro** = `.astro` estático; **TSX** = `.tsx` de servidor, también dentro de islas; «+ script» = comportamiento en `src/scripts/`. «Props» = `index.d.ts` + DP1–DP6 salvo lo indicado. «Sustituye» cita el código actual; lo que una página deja de usar se borra en la migración de esa página (§8–§11).

#### 7.2.1 Estructura

| DS | Archivo | Render | Props del sitio | Sustituye |
|---|---|---|---|---|
| `SkipLink` | `components/layout/SkipLink.astro` | Astro | `locale`. `href` fijo `#contenido`. | `.skip-link` hacia `#main-content` (`layouts/AppLayout.astro:105`) |
| `PageLayout` | `layouts/PageLayout.astro` | Astro + scripts | `locale`, `title`, `description`, `alternates: Record<Locale, string>` (§13), `breadcrumb?: BreadcrumbItem[]`, `toc?: TocItem[]`, `rhythm?: 'page' \| 'home'`, `preloadGameFont?: boolean` (§3.9), `noindex?: boolean`. Con `toc` de 2 o más entradas el rail es `Toc`; sin él, el espaciador `layout-spacer`. `<main id="contenido">` y `Footer` fijos. Slot por defecto = columna principal. | `layouts/AppLayout.astro` entero |
| `Header` | `components/layout/Header.astro` | Astro + scripts | `locale`, `home?: boolean` (sin buscador centrado), `alternates`. Sin botón de tema (X2). | Cabecera de `AppLayout.astro:107-161`: emblema SVG, formulario de búsqueda (`:117-130`), indicadores falsos (`:143-158`) |
| `SearchTrigger` | `components/layout/SearchTrigger.astro` | Astro + `scripts/search-shortcut.ts` | `variant`, `locale`. `<button type="button" data-ac-search-open aria-haspopup="dialog" aria-controls="buscar-dialogo">`; en `header` y `home`, `aria-keyshortcuts="Control+K Meta+K"` y el keycap fijo «Ctrl + K». | `components/wiki/WikiSearch.tsx` (formulario con `<Kbd>Ctrl K</Kbd>` sin atajo, `:44`) |
| (sitio) `LanguageMenu` | `components/layout/LanguageMenu.astro` | Astro + `scripts/popover-anchor.ts` | `locale`, `alternates`, `touch?`. 7.10.1. | Enlace de idioma con chevron decorativo (`AppLayout.astro:133-142`) |
| `Sidebar` | `components/layout/Sidebar.astro` | Astro + script en línea (§5.7) | `locale`, `top`, `groups` (datos de navegación de §8), `currentPath`, `touch?`. Grupos con `<details>` (7.10.2). | Barra de `AppLayout.astro:164-230` (iconos lucide, nota «Server Save · 00:00 BR» `:226-229`) |
| `MobileMenu` | `components/layout/MobileMenu.astro` | Astro + `scripts/mobile-menu.ts` | `locale`, los datos de `Sidebar`, `alternates`. `<dialog id="menu-movil">` (7.10.3). | `<details class="wiki-mobile-nav">` (`AppLayout.astro:232-246`) |
| `Toc` | `components/layout/Toc.astro` | Astro + `scripts/toc-spy.ts` | `items: TocItem[]` (2 o más), `locale`. Sin `current` (7.11). | — |
| `Breadcrumb` | `components/layout/Breadcrumb.tsx` | TSX (C-R1) | Como DS. | Migas ad hoc de cada página |
| `PageTitle` | `components/layout/PageTitle.tsx` | TSX (C-R1) | Como DS. | h1 con kicker de cada página (§12) |
| `Section` | `components/layout/Section.tsx` | TSX (C-R1) | `id` obligatorio (lo usa `Toc`), `title`, `level`. | Secciones ad hoc |
| `Footer` | `components/layout/Footer.astro` | Astro | `locale`. | — |

#### 7.2.2 Controles

| DS | Archivo | Render | Props del sitio | Sustituye |
|---|---|---|---|---|
| `Button` | `components/controls/Button.tsx` | TSX | `icon`: un `Glyph`. `href` pinta `<a>`. | `components/ui/button.tsx` |
| `TextLink` | `components/controls/TextLink.tsx` | TSX | `href` obligatorio, sin `#` por defecto. | — |
| `TextField` | `components/controls/TextField.tsx` | TSX | Como DS. | `components/ui/input.tsx` |
| `NumberField` | `components/controls/NumberField.tsx` | TSX | Como DS. | — |
| `RangeField` | `components/controls/RangeField.tsx` | TSX | Como DS. Quien lo usa interpreta «50kk» con `parsePokedolares` (§4.3). | — |
| `Select` | `components/controls/Select.tsx` | TSX | Como DS salvo DP5. Porta el combobox de solo selección de la referencia: foco en el disparador, `aria-activedescendant`, salto por letra. La lista es `popover="manual"` en la capa superior, posicionada con `@floating-ui/dom` (`bottom-start`, `flip`, ancho mínimo = el del disparador), así ningún `overflow` la recorta. | `<select>` nativos de `components/wiki/PokedexGrid.tsx:223,242,261` |
| `SortSelect` | `components/controls/SortSelect.tsx` | TSX | `options` obligatorio: lo da la lista (7.7.2). Sin los tres órdenes de Comercio por defecto. | — |
| `ToggleGroup` | `components/controls/ToggleGroup.tsx` | TSX | `sprite` de una opción: `SpriteProps` o `'shiny'` (pinta `ShinyMark`). | Selector de variante de `PokedexGrid`; `GuildStatusStrip` (§10) |
| `ViewToggle` | `components/controls/ViewToggle.tsx` | TSX | Como DS. | — |
| `Pagination` | `components/controls/Pagination.tsx` | TSX | `hrefFor` obligatorio; `onPage` lo pone el controlador de listas. Con `pageCount ≤ 1` no se renderiza. | «Mostrar más» de `PokedexGrid.tsx:357-367` y `components/wiki/ContentSearch.tsx`; `GuildPagination` (§10) |
| `FilterBar` | `components/controls/FilterBar.tsx` | TSX | Como DS. | Barras de filtros ad hoc |

#### 7.2.3 Contenido

| DS | Archivo | Render | Props del sitio | Sustituye |
|---|---|---|---|---|
| `Chip` | `components/content/Chip.tsx` | TSX | `sprite`: `SpriteProps` de 16. Con `tip: TipData` es un `NestedEntity` (`chip` o `chip-text`). | — |
| `Count` | `components/content/Count.tsx` | TSX | Como DS. | — |
| `Note` | `components/content/Note.astro` | Astro | Como DS. | — |
| `InfoBanner` | `components/content/InfoBanner.astro` | Astro | `sprite`: `SpriteProps` a 1x en la caja de 64 × 32 (animado solo el Diamond de Comercio). `facts: string[]`. | — |
| `Notice` | `components/content/Notice.tsx` | TSX | Como DS. | — |
| `EmptyState` | `components/content/EmptyState.tsx` | TSX | Como DS. | Vacíos de `PokedexGrid` y `ContentSearch` |
| `DataTable` | `components/content/DataTable.tsx` | TSX | Como DS. Las cabeceras ordenables solo funcionan dentro de una isla; una tabla en Astro no pasa `sortable`. | Tablas ad hoc |
| `Timeline` | `components/content/Timeline.astro` | Astro | `steps[].sprite`: `SpriteProps` en caja de 20; `steps[].chips`: props de `Chip`. | — |
| `FactLine`, `FactLines` | `components/content/FactLine.tsx` | TSX | Como DS. Un valor que es entidad es un `NestedEntity` (`up`, `start`). | — |
| `InfoCard` | `components/content/InfoCard.astro` | Astro | `sprite`: `SpriteProps`. | — |

#### 7.2.4 Juego

| DS | Archivo | Render | Props del sitio | Sustituye |
|---|---|---|---|---|
| `Sprite` (+ `frameForQuantity`, `animationTimeline`) | `components/game/Sprite.tsx` | TSX | 7.4. | `components/sprites/Sprite.tsx` y `components/sprites/Sprite.astro` |
| (sitio) `SpriteStyles` | `components/game/SpriteStyles.astro` | Astro | Sin props. 7.4.2. | `components/sprites/SpriteStyles.astro` |
| `ShinyMark` | `components/game/ShinyMark.tsx` | TSX | Como DS. | «✦» de `PokedexGrid.tsx:324` |
| `SpriteStage` + `MissingSprite` | `components/game/SpriteStage.tsx` | TSX | Como DS (7.4.4). | Inicial de respaldo (`pokemon-art-fallback`) de `PokedexGrid`; `PokemonPortrait` de `components/trade/TradeDesk.tsx` (§9) |
| `GameTooltip` | `components/game/GameTooltip.tsx` | TSX | 7.5. | — |
| `NestedEntity` | `components/game/NestedEntity.tsx` | TSX + `scripts/game-tooltip.ts` | 7.5. | — |
| `EntitySlot` | `components/game/EntitySlot.tsx` | TSX | `tip: TipData`. Colocación fija `side` (7.5.5). | — |
| `ElementChip` | `components/game/ElementChip.tsx` | TSX | `element: { id: string; name: string; icon: SpriteProps \| null; tip: TipData }` (`tip` sale del registro de elementos, 7.5.3). La forma de solo icono de la tarjeta compacta sale por container query (7.6.4), no por prop. | Chips de tipo de `PokedexGrid` |

#### 7.2.5 Dinero y Comercio

| DS | Archivo | Render | Props del sitio | Sustituye |
|---|---|---|---|---|
| `PokedolaresAmount` | `components/money/PokedolaresAmount.tsx` | TSX | `amount: number \| null` en unidades enteras; sin `src` (el sprite `ui/pokedolares` lo pone el componente vía adaptador). | `formatWhole` y `formatPokedolares` de `lib/trade/draft.ts:18-32` (§4.6) |
| `DiamondsAmount` | `components/money/DiamondsAmount.tsx` | TSX | `amount: number \| null`; sin `src`, `frames`, `durations` ni `tipRows`. Con `link` es un `NestedEntity` (`up`, `end`) con `diamondsTip` (7.5.3). | — |
| `PriceOptions` | `components/money/PriceOptions.tsx` | TSX | `options: { kind: 'pd' \| 'dia'; amount: number }[]`. | — |
| `Rating` | `components/money/Rating.tsx` | TSX | Como DS; un decimal con punto en ambos idiomas (X5). | — |
| `ContactChip` | `components/money/ContactChip.tsx` | TSX | Como DS. | — |
| `ChipRow` | `components/money/ChipRow.tsx` | TSX | Como DS. | — |
| `PlusN` | `components/money/PlusN.tsx` | TSX + `scripts/game-tooltip.ts` | Sin estado propio: lo atiende el controlador (7.5.8). | — |
| `HeldStrip` | `components/money/HeldStrip.tsx` | TSX | `items: { name: string; tier?: string; sprite: SpriteProps \| null; tip: TipData; href: string }[]`. | — |
| `TrainingMeter` | `components/money/TrainingMeter.tsx` | TSX | Como DS. | — |

#### 7.2.6 Tarjetas y rejillas

| DS | Archivo | Render | Props del sitio | Sustituye |
|---|---|---|---|---|
| `CardGrid` | `components/cards/CardGrid.tsx` | TSX | `family`, `children` (DP6). 7.6. | `.pokedex-grid` de `PokedexGrid` |
| `cardKit` | `components/cards/Card.tsx` | TSX | Exporta `Card`, `Zone`, `Head`, `Title`, `Meta`, `ShinyLine`, `tipHead`; `span` lo calcula `trackCount` (7.6.2). | — |
| `CardGroup` | `components/cards/CardGroup.tsx` | TSX | `sprite`: `SpriteProps` en celda de 32. | — |
| `FactList` | `components/cards/FactList.tsx` | TSX | Como DS. | — |
| `ListingCard` (+ `listingLayout`, `gridKeys`, `listingKeys`) | `components/cards/ListingCard.tsx`; funciones en `lib/cards/layout.ts` | TSX | `listing.sprite`: `SpriteProps` (arte con `smooth`) o `null`; `helds` como `HeldStrip`; entidades anidadas con `tip: TipData`. `layout` obligatorio. | Vista previa de `TradeDesk` (§9) |
| `DexCard` | `components/cards/DexCard.tsx` | TSX | Sin `compact` ni `side` (7.6.4 y 7.5.5). `entry.art`: URL del arte o `null`; `elements`: como `ElementChip`; `drops[].tip: TipData`. | `.pokemon-card` de `PokedexGrid` |
| `LootCard` (+ `lootKeys`, `lootValues`) | `components/cards/LootCard.tsx`; funciones en `lib/cards/layout.ts` | TSX | Sin `compact` ni `side`. `keys` obligatorio. `dropDe` de un Pokémon y `element` llevan `tip: TipData`. | — |
| `KpiCard` | `components/cards/KpiCard.tsx` | TSX | Como DS. | — |
| `ListRow` | `components/cards/ListRow.tsx` | TSX | `tip: TipData`. Sin `up`: la alineación con el borde inferior la decide el controlador (7.5.5). | — |
| `SlotsPanel` | `components/cards/SlotsPanel.tsx` | TSX | Como DS. | — |

#### 7.2.7 Inicio, Pokédex y Guild

| DS | Archivo | Render | Props del sitio | Sustituye |
|---|---|---|---|---|
| `HomeIntro` | `components/home/HomeIntro.astro` | Astro | `description` con cifras de los registros (X4). | Intro con kicker de `pages/[locale]/index.astro:95-110` (§8, §12) |
| `FeaturedCard`, `FeaturedSection` | `components/home/FeaturedCard.tsx`, `components/home/FeaturedSection.tsx` | TSX (C-R1) | `sprite`: `SpriteProps`. | — |
| `IndexPanel` | `components/home/IndexPanel.astro` | Astro | `sprite`, `links[].icon`: `SpriteProps` (celda de 32); `links[].tip: TipData` lo convierte en `NestedEntity` (`up`, `start`). | — |
| `WorldsTable` | `components/home/WorldsTable.tsx` | TSX | Mientras los mundos no traigan `online`: solo la columna «Mundo», sin botón de orden, filas por nombre con orden numérico (X3), sin isla. Con `online`: dos columnas ordenables en una isla `client:visible`. | — |
| `EvolutionChain` | `components/pokemon/EvolutionChain.astro` | Astro | `stages[].sprite`: `SpriteProps` del outfit a 1x (dirección `sur`, R18) o `null`; `tip: TipData` en etapas e ítems. | — |
| `BarChart` | `components/guild/BarChart.tsx` | TSX (isla de Guild) | `days[].tip` como datos; el tooltip compacto lo abre el controlador (7.5.5). | — |
| `Sparkline` | `components/guild/Sparkline.tsx` | TSX | Como DS. | — |
| `PeriodFilter` | `components/guild/PeriodFilter.tsx` | TSX | Como DS. | — |

`components/Cover/` del DS es la portada de su documentación y no se implementa.

#### 7.2.8 Piezas del sitio sin componente del DS

Las piden §8–§10 y el DS no las tiene. Se componen solo con tokens, estilos de texto y piezas del DS (R16), sobre elementos nativos (§3.8, E8).

| Pieza | Archivo | Render | Base y aspecto | La usan |
|---|---|---|---|---|
| `Dialog` | `components/controls/Dialog.tsx` | TSX (dentro de una isla) | `<dialog>` con `showModal()`: foco atrapado, Escape (evento `cancel`) y resto de la página inerte; el foco vuelve al disparador. Panel `bg-primary`, borde 1 px `border-secondary`, radio `radius-12`, título h2 y botón de cierre con `closeLabel` obligatorio (U-01). Velo `::backdrop` en `overlay` con blur de 4 px. Al abrir emite `ac:modal-open` (TT12) | §9.11, §10.9, §10.10, §10.11 |
| `Combobox` | `components/controls/Combobox.tsx` | TSX (dentro de una isla) | Campo con el aspecto de `TextField` y listbox `popover="manual"` posicionado con `@floating-ui/dom`; patrón ARIA y teclado de la paleta (7.9.3, 7.9.4): `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`. Admite texto libre cuando la sección lo pide | §9.7.2, §9.7.3, §11.3 |
| `Checkbox` | `components/controls/Checkbox.tsx` | TSX | `<input type="checkbox">` con su `<label>`; foco y estados de §5.2 | §9.7.4, §9.9 |
| `RadioGroup` | `components/controls/RadioGroup.tsx` | TSX | `<fieldset>` con `<legend>` e `<input type="radio">` | §9.11 |
| `Textarea` | `components/controls/Textarea.tsx` | TSX | `<textarea>` con el aspecto de `TextField` (`type-field`, `radius-11`) | §9.7.7, §9.11, §10.10 |
| `IndexLinks` | `components/home/IndexLinks.tsx` | TSX (C-R1) | La rejilla de enlaces de `IndexPanel` sin su franja de título | §8.0.2 (plantilla D), §8.6 |
| Pestaña enlace | Variante `href` de `ToggleGroup variant="tab"` en `components/controls/ToggleGroup.tsx` | TSX | Cada opción es un `<a>` con la forma de la pestaña. La actual lleva `aria-current="page"` y el estado «Actual» de §5.2 (fondo `bg-tertiary`), nunca la selección ámbar ni `aria-pressed`: el ámbar no marca un enlace (T9) | §8.5 |
| Puntos de un paso | Prop `steps[].points: string[]` de `Timeline` | Astro | `<ul>` bajo el texto del paso | §8.7 |

### 7.3 Islas y scripts

| Pieza | Directiva o carga | Dónde | Por qué |
|---|---|---|---|
| `SearchPalette` | `client:idle` | Una por página, en `PageLayout` | Filtra un índice en el cliente (7.9). |
| Raíz de cada lista (Pokédex, Tier list, Ítems, Comercio, perfil del vendedor, resultados de Buscar) | `client:load` | La página de la lista (§8, §9) | Filtros, orden, vista y página (7.7). |
| Raíz de una lista secundaria (drops de la ficha) | `client:visible` | Ficha de Pokémon (§8) | Solo necesita JS al llegar a ella. |
| `OutfitPreview` | `client:visible` (como hoy, `pages/[locale]/pokedex/[slug].astro:143`) | Ficha de Pokémon (§8) | WebGL del aura. |
| Herramientas de Guild y Comparar | `client:load` | §10, §11 | Estado de la herramienta. |
| Cuenta, crear anuncio, operaciones y moderación | `client:load` | §9.7, §9.9–§9.11 | Formularios y sesión. |
| `WorldsTable` con columna «En línea» | `client:visible` | Inicio | Orden por columna (X3). |
| `scripts/game-tooltip.ts` | `<script>` en `PageLayout` | Todas las páginas | Tooltips del juego y «+N» (7.5.4). |
| `scripts/search-shortcut.ts` | `<script>` en `PageLayout` | Todas | Ctrl + K y clics en disparadores antes de hidratar la paleta (7.9). |
| `scripts/mobile-menu.ts` | `<script>` en `PageLayout` | Todas | Hoja móvil (7.10.3). |
| `scripts/popover-anchor.ts` | `<script>` en `PageLayout` | Todas | Posición del listado de idiomas (7.10.1). |
| `scripts/toc-spy.ts` | `<script>` en `PageLayout` solo con `toc` | Páginas con rail | Sección actual (7.11). |
| `scripts/art-loading.ts` | `<script>` en `PageLayout` | Todas | Estado «cargando» del arte remoto (7.4.4). |

Ningún otro componente lleva directiva. Fuera de `SearchPalette`, que hidrata en `client:idle` en todas las páginas, una página sin lista ni herramienta no hidrata React.

### 7.4 Sprite

#### 7.4.1 Registro y adaptador

- La fuente es `public/sprites/sprites.json` (clave → `archivo`, `frame`, `frames`, `modo`, `umbrales`, `duracionMs`, `loop`, `direcciones`, `borrador`), validado por `pnpm content:check` y por `src/lib/content/registry.ts:86-87`.
- El adaptador (§3.12) traduce una clave y sus opciones (`frame`, `cantidad`, `animado`, `escala`, `direccion`) a `SpriteProps`: `archivo` → `src`, `frame` → `size`, `frames`, `modo` → `mode`, `umbrales` → `thresholds`, `duracionMs` → `durations`, `loop`. Se apoya en las funciones puras de `src/lib/sprites/resolve.ts` y es seguro en el cliente como `src/lib/sprites/registry.ts`.
- Una clave que no existe falla el build, como hoy (`resolve.ts:63-67`). Una entidad conocida sin sprite en su registro llega como `null` y se dibuja con `MissingSprite`.
- Las validaciones actuales se conservan: cantidad en un sprite que no es de cantidad (`resolve.ts:91-99`), fotograma fuera de rango, animación sin `duracionMs` o con otro número de fotogramas (`resolve.ts:104-127`) y escala no entera o fuera de 1 a 16 (`resolve.ts:198-201`) lanzan `SpriteError` en el build.

#### 7.4.2 Props, modos y marcado

Props: las de `SpriteProps` de `index.d.ts` (`src`, `size`, `frames`, `mode`, `frame`, `quantity`, `thresholds`, `durations`, `loop`, `scale`, `smooth`, `width`, `height`, `cell`, `alt`, `bounce`) más `half?: true` y `loading?: 'lazy' | 'eager'`.

| Modo | Fotograma mostrado | Ejemplo |
|---|---|---|
| `estatico` | 0 | `ui/pokedolares`, balls de 32 |
| `variante` | `frame` | `items/stones/fire-stone`, 0 a 7 |
| `cantidad` | El índice del último umbral que alcanza `quantity`; por debajo del primero, 0 (`resolve.ts:79-89`) | Alliance Ball: 1, 2, 3, 4, 5, 10, 25, 100 |
| `animacion` | Recorre los fotogramas con `durations` en pasos; sin `durations` activas, fotograma 0 | `ui/diamond`: 7 × 110 ms |

- **Marcado (E9).** Se conserva la técnica actual, que funciona sin JS: un `<img class="ac-sprite">` con `width` y `height` = fotograma × escala, `object-fit: cover`, `object-position` en porcentaje para el fotograma (`resolve.ts:137-140`) y `image-rendering: pixelated`. No se porta el `span` con hoja desplazada de la referencia: sus keyframes se escriben en `document` en el cliente y no existirían en el HTML prerenderizado.
- **Animación.** `SpriteStyles.astro`, en el `<head>` de `PageLayout`, escribe en el build un `@keyframes` por cada firma de animación distinta del registro: nombre `ac-sprite-<frames>-<duraciones unidas por «-»>` y sufijo `-once` con `loop: false`. Solo corre dentro de `@media (prefers-reduced-motion: no-preference)` y anima `object-position` con `steps(1, end)`. `Sprite` pone `data-anim="<nombre>"`. Cambia `animationCss` y `registryAnimationCss` (`resolve.ts:166-190`: hoy el nombre sale de la clave y el selector es `.sprite[data-sprite-anim=…]`, `:179`). Una firma que no está en el registro falla el build.
- **Escala.** Entera (`scale`, mínimo 1). `half` dibuja el sprite a la mitad: solo lo usa el Diamond del grupo «Destacados» de `Sidebar` (R11); una prueba de §14 comprueba que ningún otro archivo pasa `half`.
- **Ilustración** (`smooth`): arte de Pokémon (140 px de origen, URL de `src/lib/content/pokemon-media.ts:3-7`) e iconos de elemento (100 px). `<img class="ac-sprite ac-sprite--smooth">` con `width`/`height`, `object-fit: contain`, sin `pixelated`. En el cliente, `scripts/art-loading.ts` marca `data-state="loading"` hasta el evento `load` (escucha en captura sobre `document`; las imágenes ya completas se marcan al iniciar). Mientras carga, la caja muestra el pulso de `SpriteStage.loading` y la imagen entra con el fundido de 300 ms.
- **Nombre accesible.** `alt` vacío por defecto: `aria-hidden="true"`. El nombre de la entidad va en texto o en el `aria-label` del disparador.
- **Carga diferida.** `loading="lazy"` en tarjetas y slots con índice ≥ 4 dentro de su lista (4 es el máximo de columnas de una rejilla); el resto `eager`.

#### 7.4.3 Celda y centrado

`cell` coloca el sprite en una celda de juego de 32 (64 si el fotograma mide más de 32) a escala `k`, centrado en píxeles enteros: `left = floor((C − w) / 2) · k`, `top = floor((C − h) / 2) · k` (`DS:guias/20 §Escala entera`). La función pura es `cellPlacement(frame, k)` en `src/lib/sprites/cell.ts`, con prueba unitaria (un sprite de 15 × 15 a 2x queda en 16, 16).

#### 7.4.4 SpriteStage y estados

`SpriteStage` elige la escala por caja: 72 y 64 → celda de 64, un sprite de 32 a 2x y uno de 64 a 1x; 44, 40, 36 y 32 → celda de 32 a 1x. Estados de la referencia: con sprite, arte (sin marco), contador de pila (12/16 700, `white`, `text-shadow-game`), faltante (`MissingSprite` de la mitad de la celda), vacío (solo marco, únicamente cuando la capacidad vacía es dato del juego) y cargando (`loading`). La caja es `aria-hidden`.

#### 7.4.5 Cambios en el código actual

| Archivo | Cambio |
|---|---|
| `components/sprites/Sprite.tsx`, `Sprite.astro` | Se borran; los sustituye `components/game/Sprite.tsx`. La API por clave (`id`, `cantidad`, `animado`, `escala`, `direccion`, `decorative`) pasa al adaptador. |
| `components/sprites/SpriteStyles.astro` | Pasa a `components/game/SpriteStyles.astro` con keyframes por firma. |
| `lib/sprites/resolve.ts` | Nombre y selector de las animaciones (7.4.2). El resto sigue igual. |
| `tests/sprites/resolve.test.ts` | Actualiza las expectativas de nombres de keyframes (`:134-157`) (§14). |

### 7.5 GameTooltip y entidades anidadas

#### 7.5.1 Piezas

- `GameTooltip.tsx`: pinta el panel a partir de un `TipData`. `variant: 'popover'` (por defecto) o `'sheet'` (ficha fija, 7.5.9); `inline` para contextos de solo contenido de frase.
- `NestedEntity.tsx`: pinta un envoltorio `<span class="ac-nested-entity" data-ac-tt>` con el disparador y, como hermano, el panel `GameTooltip` con `id`, `role="tooltip"` y `popover="manual"`. El panel está en el HTML desde el servidor, oculto por el navegador mientras el popover está cerrado.
- `scripts/game-tooltip.ts`: un único controlador por página, sin React, que abre, cierra, fija y posiciona todos los paneles con `@floating-ui/dom`, y también los popovers «+N».
- `src/lib/tooltip/types.ts` (`TipData`), `src/lib/tooltip/build.ts` (constructores desde registros, 7.5.3) y `src/lib/tooltip/placement.ts` (traducción de colocaciones y middleware `avoidHead`, 7.5.5).

Motivo del diseño: el mismo marcado sirve para HTML estático y para islas, el controlador no necesita hidratar nada y `aria-describedby` apunta siempre a un elemento que existe. Se usa `@floating-ui/dom` y no `@floating-ui/react` porque las interacciones de `@floating-ui/react` exigen repartir props en cada disparador dentro de React, y los disparadores de las páginas estáticas no son React en el cliente.

#### 7.5.2 TipData

```ts
type TipWidth = 282 | 240 | 300 | 200;           // size-tt, size-tt-narrow, size-tt-wide, size-tt-chart
type TipHead =
  | { type: 'sprite'; sprite: SpriteProps | null }   // celda de 64 a 2x; null = MissingSprite de 32
  | { type: 'art'; src: string | null; aura?: { sprite: SpriteProps; label: string } }  // arte de 70
  | { type: 'icon'; sprite: SpriteProps | null }     // icono de elemento a 32, suave
  | { type: 'none' };                                // tooltip compacto del gráfico
type TipValue =
  | string                                           // nunca se parte
  | { list: string[] }                               // «a, b»: se parte solo entre elementos
  | { pd: number }                                   // PokedolaresAmount
  | { dia: number }                                  // DiamondsAmount sin enlace
  | { price: { kind: 'pd' | 'dia'; amount: number }[] };  // PriceOptions variant="tooltip"
type TipRow = { label: string; value: TipValue };    // label sin dos puntos: los pone GameTooltip
type TipSection =
  | { kind: 'held'; label: string; items: { name: string; sprite: SpriteProps | null }[] }
  | { kind: 'train'; label: string; stat: string; level: number; percent: number };
type TipData = {
  key: string;            // '<tipo>:<id>', p. ej. 'item:fire-stone', 'pokemon:shiny-charizard'
  title: string;
  width: TipWidth;
  head: TipHead;
  shiny?: boolean;
  rows: TipRow[];         // solo filas con valor
  grid?: boolean;         // anuncio: rejilla de dos columnas
  sections?: TipSection[];
  market?: TipRow[];      // bloque de mercado del anuncio (§9)
  dayTitle?: string;      // solo tooltip compacto del gráfico (§10)
};
```

Reglas de pintado (`DS:guias/10 §Anatomía`): nombre en `tt-title`; etiqueta con dos puntos en `tt-label`; valor en `tt-value`, alineado a la derecha y con `white-space: nowrap`; importes con su sprite; secciones plegables abiertas por defecto; franja «Mantén Shift para fijar» / «Hold Shift to pin» en `variant="popover"`. Las secciones son `<details open>` con `<summary>` (botón a todo el ancho y chevron de 12 en `tt-hint`), así se pliegan sin JS. Con `inline` el panel se pinta solo con `span` (un `div` no puede ir dentro de un `<p>`) y no admite `sections`: el tipo lo impide.

#### 7.5.3 Contenido desde los registros

Los constructores de `src/lib/tooltip/build.ts` reciben registros ya leídos (no importan Zod, `fs` ni `content/`), así corren en el frontmatter y en una isla con el mismo resultado. Solo emiten filas con valor. Las etiquetas salen del diccionario (§13); los términos del juego se escriben como en el cliente (T23).

| Constructor | Ancho | Cabeza | Filas | Registro |
|---|---|---|---|---|
| `pokemonTip(p, locale)` | 282 | `art` (70), `shiny` si `variante` es shiny | Requisito («Nivel N»), Tier, Elementos (nombres unidos con « / »), Moveset (nombre del elemento de `elementoMoveset`), Nº, Generación, Rol, Rasgos (Fast, Heavy) y Habilidades (de campo) | `content/pokemon.json`: `nivel`, `tier`, `elementos`, `elementoMoveset`, `numero`, `generacion`, `funcion`, `rapido`, `pesado`, `habilidades`, `imagen` |
| `elementTip(e, locale)` | 240 | `icon` | Stone, Fragment, Ball (las Balls cuyo `ball.elementos` lo nombra) | `content/elementos.json` (§8.0.5); `ball` de `content/items/poke-balls.json` |
| `itemTip(i, locale)` | 282; 240 en `diamantes`; 300 en `helds` | `sprite` | Bajo la cabeza, el texto del juego (`descripcion`, «qué hace»; párrafo que se parte, con `lang` si no es el idioma de la página). Filas, en este orden y solo con valor: Categoría, Ranura y Tier (`held`), Mega Evolución de (`mega.pokemon`), Evoluciona (Pokémon cuya `evolucion` pide el ítem), Drop de (Pokémon cuyo loot lo incluye en Base, Wildscape o Primal, en el orden de §8.0.5), Se obtiene en (tiendas, Battle Pass, Calendario, tareas y Crafteo de `obtencion`), Elemento (`elemento`, o los elementos cuya Stone o Fragment es), Tasa de captura, Más efectiva con y Aura (`ball`), Uso (`uso`), Precio NPC (`precioNpc.vende`), Precio de tienda (`precioNpc.compra`) y Mercado (`mercado`). Las mismas en todas las categorías (§8.5, Q12). Importes como `{ pd }`. | `content/items/<categoria>.json`; `drops`, `dropsPorZona` y `evolucion` de `content/pokemon.json`; `content/elementos.json`; `content/auras.json` (§3.13) |
| `gearTip(kind, g)` | 300 | `sprite` | Aura: Viene con (las Balls cuyo `ball.aura` es ella). Addon: Pokémon (el de su outfit) | `content/auras.json`, `content/outfits.json`, `ball` de las Balls |
| `systemItemTip(o, locale)` | 282 | `sprite` (`sprite` del registro, o `null`) | Sistema (título de la página de `o.sistema`), Uso (`descripcion`, con `lang="en"` en `es` mientras solo exista en inglés) | `content/system-items.json` (E16) |
| `diamondsTip(locale, animated)` | 240 | `sprite` del Diamond a 2x, animado solo en Comercio | «Se compran en», «Se usan en»: listas del objeto `moneda` (§8.5). El código no escribe esos valores. | `content/items/diamantes.json` |
| `systemTip(s, locale)` | 282 | `sprite` del sistema | Las filas de tooltip del registro | `content/sistemas/` (§8.4) |
| `listingTip(l, locale)` | 282, `grid` | `art` o `sprite` | Título: el nickname o `listingTitle(l, locale).texto` (§9.4). Claves de la familia del anuncio + `market` | §9 |
| `chartDayTip(d, locale)` | 200 | `none` | Las cifras del día | §10 |

Una prueba unitaria por constructor comprueba: sin `null` ni «—» en `rows`, etiquetas del diccionario del locale y el ancho de la tabla. `tests/game/tip-complete.test.ts` comprueba con registros reales que cada tipo de entidad muestra todas sus filas y que el panel de una lista es el mismo que el de su página.

Regla del propietario (2026-09-25): todo tooltip completo en todas partes. Las páginas componen los registros de los constructores en el servidor con `src/lib/game/tip-records.ts` (hechos derivados en `src/lib/game/item-facts.ts`). Las islas de lista (Ítems, Pokédex, Tier list, búsqueda, publicar, «Mis anuncios») construyen sus paneles con sus `datos.json` y, para no pasar sus presupuestos (§13.6), reciben el resto de cada panel en un solo archivo por idioma, `/{l}/paneles.json` (`src/lib/game/panels.ts`): los hechos de cada ítem, el número, moveset, rasgos y habilidades de cada Pokémon, las Balls de cada elemento y aura, el Pokémon de cada addon y las etiquetas de esas filas. Hasta que llega, el panel muestra las filas que ya tenía. Comercio lleva los mismos hechos en sus `refs`. Un tooltip de tier sin `maxBrokes` no tiene fila (nunca «—»).

#### 7.5.4 Controlador: comportamiento

Estado: un conjunto de paneles abiertos, cada uno con su envoltorio, su motivo (`hover`, `focus`, `tap`, `row`) y si está fijado; y `active`, el último que se abrió (el que fija Shift). Los manejadores están en `document` (delegación).

| # | Evento | Efecto |
|---|---|---|
| TT1 | `pointerover` de ratón o lápiz que entra en un `[data-ac-tt]` | Abre su panel (`hover`). Cancela un cierre pendiente de ese envoltorio. |
| TT2 | `pointerout` que sale del envoltorio (el `relatedTarget` no está dentro) | Si no está fijado ni tiene foco de teclado, programa el cierre a 100 ms; se cancela si el puntero vuelve al disparador, al puente o al panel. |
| TT3 | `focusin` en el disparador | Abre (`focus`). Con foco de teclado (`:focus-visible`) sigue abierto aunque salga el puntero, hasta `focusout`. Un foco de clic se cierra con el puntero, como en la referencia. |
| TT4 | `focusout` hacia fuera del envoltorio | Cierra si no está fijado ni bajo el puntero. |
| TT5 | Toque (`pointerdown` con `pointerType === 'touch'` y después `click`) | Primer toque en un disparador cerrado: `preventDefault` y abre (`tap`). Segundo toque con el panel abierto: un `<a>` navega; un `<button>` cierra. |
| TT6 | `pointerdown` fuera de todos los envoltorios abiertos | Cierra los no fijados. |
| TT7 | `keydown` Escape | Cierra todos los paneles, fijados incluidos. Si el foco está en una fila de Lista, esa fila no reabre por hover hasta que el puntero salga y vuelva a entrar. |
| TT8 | Shift | `keydown` Shift sin `repeat` guarda la hora y si el foco está fuera de un campo editable (`input` de texto, `textarea`, `select`, `contenteditable`). Otra tecla o un `pointerdown` antes de soltar lo invalida. Al `keyup` de Shift, si sigue válido, pasaron 400 ms o menos y `active` está abierto, fija o suelta `active`. Fijar `active` suelta y cierra el panel que estaba fijado. Shift+Tab y Shift+clic nunca fijan. |
| TT9 | Apertura de cualquier panel o «+N» | Cierra todos los demás no fijados. Regla única del sitio: como máximo un panel sin fijar y un panel fijado a la vez (`DS:guias/10 §Comportamiento`, que manda sobre `DS:NestedEntity` según §1.1). |
| TT10 | `pointerenter` en `tr[data-ac-tt-row]` | Abre el panel del nombre de esa fila (`row`); `pointerleave` de la fila lo cierra si no está fijado ni enfocado. Abrir otro panel de la fila (un precio en Diamonds) cierra el del nombre. |
| TT11 | El disparador sale del DOM (una isla vuelve a pintar) | En la siguiente actualización de `autoUpdate` se comprueba `isConnected` y se cierra y limpia. |
| TT12 | Evento `ac:modal-open` (paleta, hoja móvil o `Dialog`) | Cierra todos, fijados incluidos. |
| TT13 | Scroll y cambio de tamaño | `autoUpdate` recoloca; no cierra. |

Abrir: `showPopover()`, `data-open`, cálculo con `computePosition(…, { strategy: 'fixed' })`, `data-side` con el lado final y `autoUpdate` mientras siga abierto. Cerrar: `hidePopover()`, limpieza de `autoUpdate` y de los atributos. Fijado: `data-pinned`. Entrada: la animación de 150 ms del DS (opacidad 0, 4 px más abajo, escala 0,95), ninguna con movimiento reducido. La capa superior del popover saca el panel de cualquier `overflow` (tablas con desplazamiento incluidas) y de cualquier contexto de apilamiento.

#### 7.5.5 Colocación

`NestedEntity` recibe `placement: 'up' | 'down' | 'side' | 'above-center' | 'row'` (por defecto `up`) y `align: 'auto' | 'start' | 'end' | 'column'` (por defecto `auto`) y los escribe en el envoltorio como `data-ac-tt-placement` y `data-ac-tt-align`, que es lo que lee el controlador. Traducción de las colocaciones del DS:

| DS | Sitio | `@floating-ui/dom` |
|---|---|---|
| `up-left`, `up-right` | `up` + `start` / `end` | `top-start` / `top-end`, `offset({ mainAxis: 6, alignmentAxis: -8 })`: el borde del tooltip sobresale 8 px del disparador |
| `down-left`, `down-right` | `down` + `start` / `end` | `bottom-start` / `bottom-end`, mismo `offset` |
| `side-right`, `side-left` | `side` | `right-start`, `offset({ mainAxis: 8, alignmentAxis: -8 })`; `flip` a `left-start`. Por debajo de 768: `bottom-start` a 8 px |
| `above-center` | `above-center` | `top`, `offset(6)` |
| `row-right`, `row-right-up` | `row` | Referencia virtual: x de la celda del nombre, y de la fila. `right-start`, `offset(12)`; `flip` de alineación a `right-end` en las filas bajas; sin sitio a la derecha, `bottom-start` bajo la celda del nombre. Nunca a la izquierda, sobre el sprite. |

- `align: 'auto'`: `start` si el centro del disparador queda en la mitad izquierda de su contenedor (el `article[data-anat]` más cercano; si no hay, `[data-ac-tt-scope]`; si no, la ventana), `end` si no. `'column'`: la mitad que cuenta es la de la tarjeta dentro de su rejilla (tarjetas compactas de 2 columnas).
- Middleware en orden: `offset`, `flip` (solo al lado vertical opuesto con la misma alineación en `up` y `down`), `avoidHead`, `shift({ padding: 8 })` (16 por debajo de 768) y `size({ padding: 8 })` (16 por debajo de 768), que escribe `max-height` = `availableHeight` en el panel.
- Panel más alto que la ventana (un anuncio con dos held items, entrenamiento y mercado en un teléfono): con `max-height` fijado, el panel tiene `overflow-y: auto` y `overscroll-behavior: contain`; la franja «Mantén Shift para fijar» queda al final del contenido desplazable. Sus `<summary>` son enfocables, así el desplazamiento se alcanza con teclado. Mínimo: 120 px; si `availableHeight` es menor, `max-height` es 120 y `shift` decide la posición.
- `avoidHead`: si el disparador está dentro de un `article[data-anat]` y el panel queda arriba y su borde superior cae por encima del borde inferior de `[data-zone="head"]` de esa tarjeta, se coloca debajo con la misma alineación. Gana a `flip`.
- Colocación por zona, que ponen los componentes:

| Zona o componente | `placement` | `align` |
|---|---|---|
| Hechos de `ListingCard` y `LootCard` (valores a la derecha) | `down` | `end` |
| Elementos y drops de `DexCard` | `down` | `auto` (`column` en la anatomía compacta, por CSS: 7.6.4) |
| `HeldStrip` | `up` | `auto` (columna 1 `start`, columna 2 `end`) |
| Pie de `ListingCard`: precio en Diamonds | `up` | `end` |
| Pie de `ListingCard`: «+N» de canales | `up` | `start` |
| `EntitySlot` | `side` | — |
| `ListRow` | `row` | — |
| `EvolutionChain` | `above-center` | — |
| `FactLine`, `Chip` de `Timeline`, `IndexPanel`, menciones en prosa | `up` | `start` |
| `BarChart` | `above-center`; los dos primeros días `up`+`start`, los dos últimos `up`+`end` | — |

#### 7.5.6 Puente seguro

El panel lleva un `::before` transparente en el lado que mira al disparador (según `data-side`), del ancho del panel (del alto en `side` y `row`) y del hueco más 2 px. Como el panel es descendiente del envoltorio, el puntero que cruza el hueco no sale del envoltorio. Si `shift` deja el panel fuera del eje del disparador, cubren el trayecto los 100 ms de TT2. Prueba: mover el puntero en 10 pasos rectos del centro del disparador al centro del panel lo deja abierto.

#### 7.5.7 Accesibilidad

- El disparador es un `<a href>` a la página de la entidad o un `<button type="button">` si no tiene página. Nunca un `span` con eventos.
- `aria-describedby` apunta siempre al `id` del panel (`role="tooltip"`), abierto o cerrado; el contenido del panel es la descripción accesible.
- Nombre del disparador: su texto visible o `aria-label` (slots, chips de solo icono). Sprites dentro del disparador, `aria-hidden`.
- Cumple WCAG 1.4.13: se descarta con Escape, se recorre con el puntero y persiste hasta que salen puntero y foco.
- Las secciones `<details>` del panel se alcanzan con Tab desde el disparador mientras el panel está abierto (el panel sigue al disparador en el DOM).

#### 7.5.8 PlusN

`<button data-ac-plusn aria-expanded aria-controls aria-label>` más `<ul popover="manual">` hermano. Abre con clic y toque (queda abierto aunque salga el puntero), con hover y con foco (se cierra al salir). Escape y un toque fuera lo cierran. Comparte TT9 con los tooltips. Posición con la misma traducción de 7.5.5 (`up-left` por defecto). Superficie `bg-tertiary`, borde `border-primary`, radio 8: no es el tooltip del juego.

#### 7.5.9 Ficha fija

`GameTooltip variant="sheet"`: en el flujo de la página (sin `popover`), `role="group"`, `aria-label` «Ficha de {nombre}» / «{name} sheet» (diccionario), sin franja inferior (padding inferior 12) y sin animación. Usa `div` y `dl`. Solo en la ficha de Pokémon (§8.3) y en el detalle del anuncio (§9.6), que es la ficha de un Pokémon o un ítem en venta; las dos páginas precargan Poppins (§3.9).

#### 7.5.10 Qué abre tooltip

- Nunca una tarjeta completa, `article` ni fila entera como disparador.
- Sí: cada entidad anidada de una tarjeta, cada `EntitySlot`, el nombre de cada `ListRow`, cada `Chip` o `FactLine` con `tip`, cada enlace de `IndexPanel` con `tip`, las etapas y los ítems de `EvolutionChain` y toda mención de una entidad con registro en el texto de una página (§8), con `NestedEntity inline`.
- No: `ContactChip`, `Rating`, «+N» (su propio popover), la cantidad de un anuncio de Diamonds, las opciones de `Select` y `ToggleGroup`.

### 7.6 CardGrid y anatomía

#### 7.6.1 Rejilla y columnas

`<div class="ac-card-grid" data-family>` con `container-type: inline-size` y dentro `<div class="ac-card-grid__grid">` con `grid-template-columns: repeat(var(--ac-cols), minmax(0, 1fr))` y `align-items: stretch`. Las columnas salen del ancho del contenedor con container queries (porte literal de la referencia; columnas = `clamp(floor((W + gap) / (mín + gap)), mín, máx)`):

| Familia | Por defecto | Container queries |
|---|---|---|
| `listing` | 1 col., gap 12 | gap 16 desde 480; 2 desde 576; 3 desde 872; 4 desde 1168 |
| `pokedex` | 2 col., gap 8 | gap 16 desde 480; 3 desde 812; 4 desde 1088; compacta por debajo de 495 |
| `loot` | 1 col., gap 12 | gap 16 desde 480; 2 desde 496; 3 desde 752; 4 desde 1008 |
| `featured` | 1 col., gap 8 | 2 desde 408; 4 desde 824 |
| `index` | 1 col., gap 16 | 2 desde 596; 3 desde 902 |
| `kpi` | 1 col., gap 16 | 2 desde 416; 4 desde 848 |
| `info` | 1 col., gap 16 | 2 desde 576 |

Resultado exigido: la tabla de `DS:guias/30 §Responsive` (S2).

#### 7.6.2 Tarjeta sobre subgrid

- `Card`: `<article class="ac-card" data-anat>` con `grid-row: span Z`, `grid-template-rows: subgrid` y `row-gap` 12. Cada zona es un hijo directo con `data-zone`. Hechos y pie son `dl` anidados en subgrid con una pista por fila (gap 6; pie 8; 8 con `pointer: coarse`).
- `trackCount(family, layout)` en `src/lib/cards/layout.ts`:

| Familia | Z |
|---|---|
| `listing` | 1 (cabeza) + claves + (Held Items ? 1 : 0) + (Entrenamiento ? 1 : 0) + filas del pie ((Dinero real ? 1 : 0) + (En el juego ? 1 : 0) + Vendedor + Contacto) |
| `pokedex` | 1 (cabeza) + claves (de Requisito, Tier, Rol y Variante, las de la unión) + (elementos ? 1 : 0) + (drops ? 1 : 0), todo leído del `layout` de `dexLayout` (7.6.3) |
| `loot` | 1 + claves |
| `kpi` | 3 |

- Todas las tarjetas de una rejilla reciben el mismo `layout`, así tienen el mismo Z (prueba: todas las tarjetas de una rejilla tienen el mismo `grid-row`). Ninguna familia fija Z a mano: con 12 Pokémon sin tier ni rol en la página, la rejilla de `pokedex` no tiene esas dos pistas.
- La tarjeta no es enlace ni recibe foco: su título es el enlace.
- **Nivel del título.** `CardGrid`, `CardGroup` y `Card` reciben `headingLevel: 2 | 3 | 4` (por defecto 3), el nivel del título de cada tarjeta: uno más que el encabezado inmediatamente superior. Lista sin grupos bajo el h1 (Pokédex, Ítems de una categoría, Comercio con un solo tipo): 2. Grupos h2 (Comercio «Todos», Tier list, «Todo» de Ítems, Buscar) o `Section` h2 (drops de la ficha): 3. Grupos h3 dentro de una `Section` h2 (anuncios del perfil del vendedor con «Todos»): 4. El nivel no cambia el aspecto (`body-strong`). Así ninguna página salta un nivel (WA2).

#### 7.6.3 Claves: unión del resultado

- `src/lib/cards/layout.ts` porta de la referencia `listingKeys`, `gridKeys`, `listingLayout`, `lootKeys` y `lootValues`, y añade `dexLayout(entries)` (claves de hechos de la unión y zonas `elements` y `drops` presentes) y `trackCount(family, layout)`. `present()` es falso para `null`, `undefined`, `''`, «—» y listas vacías.
- Claves de una rejilla: las canónicas de la familia, en su orden, que al menos una tarjeta de la rejilla tiene. Donde una tarjeta no tiene un valor que otra sí, «—». Zonas opcionales y filas de precio existen si al menos una tarjeta las tiene.
- En build: una rejilla estática calcula su `layout` en el frontmatter de la página con los elementos que muestra. En una isla: `useMemo` sobre los elementos de la página actual después de filtrar, ordenar y paginar. Es la misma función en los dos casos.
- Comercio «Todos»: pagina primero, agrupa después, y cada grupo calcula su `layout` con sus propias tarjetas (§9).
- `listingLayout` lanza un error si recibe anuncios de dos tipos: una rejilla nunca mezcla familias ni tipos.

#### 7.6.4 Anatomía compacta por container query

- `DexCard` compacta por debajo de 495 px de contenedor (`layout-dex-compact`), con `@container` sobre `.ac-card-grid`, nunca con JS ni con prop. El DOM es único:
  - Cabeza apilada y centrada, y título en 2 líneas centradas: solo CSS.
  - `ElementChip`: el nombre pasa a oculto visualmente y el chip a icono redondo de 24; un elemento sin icono conserva el texto.
  - Drops: cada drop es un `li` con `data-regular="slot|chip|hidden"` y `data-compact="slot|hidden"`, calculados en el render. Normal: todos los drops con sprite como slot de 36 y hasta 3 con nombre como chip (con más de 3, 2 y «+N»). Compacta: solo slots, hasta 6 (con más de 6, 5 y el «+N» cuadrado de 36); un drop sin sprite es un slot con la marca faltante. Hay dos «+N» (`data-variant="regular"` y `"compact"`) y cada uno tiene `display: none` en la otra anatomía. Lo oculto con `display: none` sale del orden de tabulación y del árbol de accesibilidad.
  - El disparador de un drop lleva siempre `aria-label` con su nombre.
  - En la anatomía compacta el container query fija `--ac-tt-align: column` en la tarjeta. El controlador lee ese valor calculado (`getComputedStyle` del disparador) y, si existe, gana al atributo `data-ac-tt-align` (7.5.5).
- `LootCard` compacta (etiqueta sobre valor, padding 12, cabeza centrada) por debajo de 240 px de contenedor, también por container query.

#### 7.6.5 Respaldo y prohibiciones

- Sin subgrid: el `@supports not (grid-template-rows: subgrid)` de la referencia (columna flex, pie abajo).
- Nunca `align-items: start`, `grid-auto-flow: dense`, `order`, colocación explícita ni `content-visibility: auto` en tarjetas (`DS:CardGrid`). Una celda vacía al final de la última fila queda vacía. Estas prohibiciones valen para las rejillas de tarjetas; el bento del Inicio es una rejilla de maquetación con áreas nombradas (E17, §8.1).
- Zoom y espaciado de texto solo hacen crecer pistas: ninguna zona tiene altura fija.

### 7.7 Tres vistas y controlador de listas

#### 7.7.1 Piezas

- `src/lib/lists/state.ts` (puro, con pruebas unitarias): `ListConfig<T>`, `ListState`, `parseListState`, `serializeListState`, `applyListState`.
- `src/components/lists/useListState.ts`: el hook que une estado y URL.
- `src/components/lists/EntityList.tsx`: barra de resultados, vistas y paginación comunes.
- Una raíz de isla por lista (Pokédex y Buscar en §8, Comercio en §9, drops de la ficha en §8). La raíz define su `ListConfig` (con funciones) en su módulo y recibe solo datos serializables.

```ts
type EntityView = 'cards' | 'slots' | 'list';
type ListConfig<T> = {
  id: string;                  // 'pokedex', 'comercio', 'drops'…; clave de almacenamiento
  prefix?: string;             // prefijo de parámetros si la página tiene otra lista
  pageSize: number;            // lo fija la sección de la lista
  sorts: { id: string; label: string; compare: (a: T, b: T) => number }[];  // [0] es el orden por defecto
  filters: { key: string; values: readonly string[] | 'text' | 'int'; test: (item: T, value: string) => boolean }[];
  text?: (item: T) => string;  // texto donde busca `q`
  groupBy?: (item: T) => string; groupOrder?: readonly string[];  // Comercio «Todos», Slots de la Pokédex
  defaultView?: EntityView;    // 'cards' si falta; 'list' en la Tier list de la ficha (E15)
  anchorId?: (item: T) => string;  // id del elemento en la vista activa, p. ej. `item-${id}` (H7)
  dataUrl?: string;            // datos completos de la lista (PR5); sin él, los datos llegan en las props
};
type ListState = { view: EntityView; q: string; sort: string; page: number; filters: Record<string, string> };
```

#### 7.7.2 Estado en la URL

- U1. Parámetros: `q`, las claves de filtro de la lista, `sort`, `view` y `page`, serializados en ese orden. Con `prefix`, cada clave es `<prefix>.<clave>`.
- U2. Un valor igual al por defecto no se escribe; una URL sin parámetros es el estado por defecto (la vista por defecto de la lista, primer orden, página 1, sin filtros).
- U3. Los valores son identificadores de registro (`slug`, número, `cards`), nunca etiquetas traducidas, así una URL sirve en los dos idiomas y `LanguageMenu` la conserva (7.10.1).
- U4. Un valor inválido cae al por defecto. Una página mayor que el total cae a la última y una menor que 1 a la 1. Tras hidratar, la URL se reescribe con `history.replaceState` a su forma canónica.
- U5. `q`: filtra en cada tecla (`useDeferredValue`) y escribe la URL 300 ms después de la última tecla, con `replaceState`.
- U6. Vista: la de la URL; si la URL no la trae, la guardada en `localStorage['ac:vista:<id>']`; si no hay o la lectura falla, `defaultView` (R3). Cada cambio de vista se guarda; lecturas y escrituras en `try/catch`.

#### 7.7.3 Historia, foco y anuncios

- H1. Cambiar de página hace `pushState`; todo lo demás (filtros, tipo, orden, `q`, vista), `replaceState`. Atrás y Adelante recorren solo las páginas visitadas: un cambio de filtro no crea una entrada de historial.
- H2. `popstate` vuelve a leer el estado de la URL.
- H3. Cambiar filtro, `q` u orden vuelve a la página 1. Cambiar de vista conserva la página.
- H4. Tras un cambio de página (no en la carga), el contenedor de resultados (`tabindex="-1"`) recibe el foco con `preventScroll` y la página se desplaza hasta dejarlo a 16 px del borde superior.
- H5. `Count` (`aria-live="polite"`) anuncia el total nuevo.
- H6. `Pagination` pinta enlaces `href` con la URL canónica de cada página (abrir en otra pestaña funciona) y el controlador intercepta el clic.
- H7. Ancla. Cada vista pone `anchorId(item)` como `id` de su elemento: el `article` en Cards, el `EntitySlot` en Slots y el `tr` en Lista; solo se monta una vista (V1), así el `id` es único. En la carga, el navegador busca el ancla antes de que exista la vista, así que el controlador la resuelve él: cuando el estado de la URL está aplicado y los datos cargados (PR4, PR5), si `location.hash` nombra un elemento de la vista activa, lo lleva a la vista con `scrollIntoView({ block: 'start' })` (respeta `scroll-padding-top`) y enfoca su disparador con `preventScroll`: el enlace o botón del título en Cards, el slot en Slots, el nombre en Lista. Si el ancla no está en la vista activa, no hace nada.

#### 7.7.4 Vistas

- V1. Solo se monta la vista activa.
- V2. Cards: `CardGrid` de la familia, o un `CardGroup` por grupo en el orden de `groupOrder`; `layout` según 7.6.3.
- V3. Slots: `SlotsPanel` (`side` para grupos por tipo, `stacked` para grupos por generación) con `EntitySlot` de 72 (anuncios y Pokédex) o 40 (drops; 44 con puntero grueso). El nombre accesible del slot es el nombre y, en anuncios, el precio exacto.
- V4. Lista: `DataTable` con `hover`, `caption` y una `ListRow` por elemento; las columnas son las claves de la unión (7.6.3) más las fijas de la familia (§8, §9). En teléfono la tabla conserva su ancho y se desplaza.
- V5. En cada página, las tres vistas muestran el mismo conjunto, y dos elementos del mismo grupo guardan el mismo orden relativo en las tres (S4). Una vista que agrupa (Cards y Slots con `groupBy`) ordena dentro de cada grupo; una que no agrupa (Lista de Comercio, Cards de la Pokédex) sigue el orden de la lista.
- V6. Barra de resultados: `Count` a la izquierda, `SortSelect` (con más de un orden) y `ViewToggle` a la derecha, `justify-content: space-between`, gap 16. `FilterBar` encima y `Pagination` debajo, a 16 px.
- V7. Sin resultados: la barra se queda y la lista se sustituye por `EmptyState` («Sin resultados para «q».» con búsqueda; sin búsqueda, el texto que fija la sección de la lista). La paginación desaparece.
- V8. El contenedor de cada vista lleva `data-card-grid` (Cards), `data-slots` (Slots) o `data-list` (Lista); los usa la medición de CLS de §13.6.

#### 7.7.5 Primer render

- PR1. `useSyncExternalStore` con `subscribe` a `popstate` y al evento propio `ac:url`, `getSnapshot` = `location.search` y `getServerSnapshot` = `''`. El HTML prerenderizado y la hidratación pintan el estado por defecto (primera página, vista por defecto, sin filtros); el estado de la URL y la vista guardada se aplican justo después, sin error de hidratación.
- PR2. Una página prerenderizada nunca lee `Astro.url.searchParams`: en el build está vacío. Hoy lo hace `pages/[locale]/buscar/index.astro:7,29`.
- PR3. Se sustituyen: la URL que solo guarda `q` y solo al enviar (`PokedexGrid.tsx:159-165`), el «Mostrar más» de 48 (`PokedexGrid.tsx:36`, `:357-367`) y de 60 (`ContentSearch.tsx:40`), y el atajo «/» (`PokedexGrid.tsx:102-117`, A22).
- PR4. Sin destello. Justo antes de la raíz de la isla, la página lleva un script en línea (clásico, sin módulo, menos de 1 KB, generado desde la misma `ListConfig`) que, antes de la primera pintura, lee `location.search` y `localStorage['ac:vista:<id>']` (en `try/catch`). Si el estado resultante difiere del prerenderizado (vista, página, orden, `q` o un filtro), pone `data-ac-pending` en la raíz. Con `data-ac-pending`, la raíz conserva la altura del HTML prerenderizado y se pinta con `visibility: hidden` (filtros, barra de resultados, vista y paginación). La isla quita el atributo cuando el estado está aplicado y sus datos cargados (PR5); si a los 5 s sigue puesto, lo quita el propio script. Con el estado por defecto no se oculta nada.
- PR5. Datos. El HTML prerenderizado lleva la primera página del estado por defecto, y las props de la isla, solo sus filas. Las listas de más de una página (Pokédex y Tier list, Ítems, Comercio de la fase A) leen el resto de `dataUrl`: un JSON prerenderizado por idioma (`src/pages/[locale]/pokedex/datos.json.ts`, que comparten Pokédex y Tier list; `src/pages/[locale]/items/datos.json.ts`; `/{l}/comercio/datos.json`, inyectado solo con `COMERCIO_DEMO` en la fase A (§9.3)), pedido con `fetch` al hidratar. Forma: `{ "v": 1, "campos": string[], "filas": unknown[][], "refs": { … } }`: una fila por entidad con los valores en el orden de `campos`, y en `refs` lo que necesitan sus tooltips (elementos; ítems de drops con su sprite ya resuelto a `SpriteProps` por el adaptador en el build). Nombres y datos van en el idioma del archivo; las etiquetas no, las pone el diccionario (DP1). `TipData` se construye en el cliente con los constructores de `src/lib/tooltip/build.ts` (7.5.3), igual que en el build. Buscar usa el índice de 7.9.1; drops, anuncios del perfil y resultados de la fase B llegan en las props o de Supabase. Si el `fetch` falla, la lista sigue con la primera página y `EmptyState` de error solo al pedir otra página, filtro o vista que necesite los datos: «No se pudieron cargar los datos.» / «Couldn't load the data.».

### 7.8 Montos

- Los formateadores viven en `src/lib/format/`: `formatPokedolares`, `parsePokedolares` y `formatInteger` portan `formatKK`, `parseKK` y `formatThousands` de la referencia. Reglas, tabla y pruebas: §4.3 y V4-1; además, 1.049.999 → «1kk» y 1.050.000 → «1,1kk» (S8).
- `PokedolaresAmount`: sprite de 32 a 1x con márgenes −8 2 −8 −3, número `aria-hidden`, texto oculto con la cifra exacta y la moneda («150.000.000 Pokédólares»). Sin importe: «—» sin sprite. Contenedor `inline-flex` con `vertical-align: top`.
- `DiamondsAmount`: fotograma 0 a 32 con márgenes −8 3 −8 −1; `animated` y `tipAnimated` solo en Comercio.
- `PriceOptions`: cada «o» viaja con su opción; nunca convierte ni suma monedas.
- Una mención de la moneda sin importe (opción de filtro, «Pago: Diamonds, Pokédólares o mixto») es texto sin sprite. «KK», «KKs» y «gold» no aparecen en ningún componente ni diccionario (S8).
- El sprite de Pokédólares nunca se reduce a 16 (`DS:PokedolaresAmount`).

### 7.9 Búsqueda Ctrl K

#### 7.9.1 Piezas

- `src/components/search/SearchPalette.tsx`: isla `client:idle`, una por página.
- `src/scripts/search-shortcut.ts`: atiende Ctrl + K y ⌘ + K y los clics en `[data-ac-search-open]`. Emite `ac:search-open` con el disparador. Si la paleta todavía no se montó, guarda la petición en `document.documentElement.dataset.acSearchPending`; la paleta la atiende al montarse.
- `src/lib/search/normalize.ts`: NFD, sin diacríticos, minúsculas. Sustituye las dos copias de `normalize` (`ContentSearch.tsx:42-47`, `PokedexGrid.tsx:79-84`).
- `src/lib/search/rank.ts`: puntuación y agrupación, puro, con pruebas.
- Índice: `src/pages/[locale]/buscar/indice.json.ts`, prerenderizado por locale. §8.6 fija qué colecciones entran.

```ts
type SearchKind = 'pokemon' | 'sistema' | 'item' | 'actividad' | 'pagina';   // orden fijo de grupos = orden del menú
type SearchEntry = { kind: SearchKind; id: string; name: string; href: string;
                     icon: SpriteProps | null; meta?: string; tip?: TipData };
```

#### 7.9.2 Apertura y cierre

- Ctrl + K o ⌘ + K abre la paleta solo si algún `SearchTrigger` es visible (`checkVisibility()`), con `preventDefault`. Con la paleta abierta, la misma combinación la cierra.
- `<dialog id="buscar-dialogo">` con `showModal()`, `aria-label` «Buscar» / «Search». Al abrir emite `ac:modal-open` (TT12).
- Cierran: Escape (`cancel` nativo), un clic en el velo, elegir un resultado (navega) y Ctrl + K. El foco vuelve al elemento que lo tenía antes de abrir (comportamiento nativo de `dialog`, con prueba en §14).
- La consulta no se guarda en la URL.

#### 7.9.3 Composición

La paleta no tiene tablero; se compone solo con piezas y tokens del DS (R16, E11):
- Panel `bg-primary`, borde 1 px `border-secondary`, radio `radius-12`, sin sombra, `position: fixed`. Se ancla al disparador que la abrió: mismo `left`, mismo `top` (de su rectángulo en la ventana) y su ancho, con un mínimo de `layout-search` (448). Abierta por atajo, se ancla al disparador visible. Si ese disparador no está entero dentro de la ventana (el `SearchTrigger` del Inicio tras desplazar la página), el panel no se ancla: se centra en la ventana con `top` = `layout-header` + `space-16` (80) y ancho `layout-search`, o el de la ventana menos 32 si es menor. Con el disparador `icon` o por debajo de 768: ancho completo con márgenes de 16 y `top` 8.
- Velo `::backdrop` en `overlay` con desenfoque de 4 px y entrada de 150 ms, como la hoja móvil.
- Campo: aspecto de `TextField variant="search"` (40 de alto, 44 con puntero grueso; lupa de 16), `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant`.
- Resultados a 8 px del campo: `role="listbox"` con un `role="group"` por tipo, en el orden de `SearchKind`, con rótulo `ui-strong` en `text-tertiary`. Cada opción es una fila de 40 (44 con puntero grueso) como un enlace de `IndexPanel`: celda de icono de 32 siempre presente (sprite a 1x en celda, arte a 24 suave o vacía), nombre en `text-secondary` y `meta` en `ui` `text-tertiary`. Opción activa: `bg-tertiary` y `text-primary`.
- Hasta 8 resultados por tipo. La lista se desplaza dentro del panel si no cabe hasta 16 px del borde inferior de la ventana.
- Consulta vacía: solo el campo. Sin resultados: `EmptyState` «Sin resultados para «consulta».». El índice se descarga con `fetch` en la primera apertura y se guarda en memoria del módulo; mientras llega, la lista está vacía; si falla, `EmptyState` con el texto de error del diccionario (§13).
- Con consulta, la última opción del listbox, fuera de los grupos y sin rótulo, es «Ver todos los resultados de «{q}»» / «See all results for “{q}”», que lleva a `/{l}/buscar/?q={q}` (§8.6).

#### 7.9.4 Teclado, ratón y orden

- ↓ y ↑ mueven la opción activa (con vuelta al principio y al final); Intro navega a la activa; al escribir, la primera opción pasa a activa. Inicio y Fin quedan para el cursor del campo.
- Pasar el puntero activa una opción; un clic navega.
- Puntuación: nombre exacto 0; prefijo del nombre 1; prefijo de una palabra del nombre 2; subcadena del nombre 3; coincidencia en `meta` o número de Pokédex exacto 4. Empates: orden de tipo y después nombre con `Intl.Collator(locale, { numeric: true })`.

#### 7.9.5 Tooltip en la paleta

Con `(hover: hover)` y ancho ≥ 768, la opción activa que tiene `tip` muestra su `GameTooltip` a 12 px a la derecha del panel, alineado con la fila (`right-start`, `shift` 8). Lo pinta la propia paleta con `@floating-ui/dom`, no el controlador. No se fija con Shift: el foco está en un campo de texto (TT8).

### 7.10 Marco

#### 7.10.1 Cabecera e idioma

- `Header.astro` según `DS:Header`: marca «Alliance Codex» (estilo `brand`) enlazada a `/{locale}/`; `SearchTrigger variant="header"` centrado (sin él en el Inicio); desde 1280, `LanguageMenu` (192 × 40); por debajo de 1280, separador y botón de menú de 44 (`aria-controls="menu-movil"`, `aria-expanded`); por debajo de 768, `SearchTrigger variant="icon"` delante del separador en páginas interiores. Sin botón de tema ni su separador (X2).
- `LanguageMenu.astro`: `<button popovertarget="idioma-…">` con globo, idioma actual y chevron, nombre accesible «Idioma: Español» / «Language: English»; lista `popover="auto"` con dos enlaces `<a hreflang lang>` a `alternates[locale]`; el actual lleva check de 16 y `aria-current="true"`. `scripts/popover-anchor.ts` la posiciona con `@floating-ui/dom` en el evento `toggle` (`bottom-end` en la cabecera, `bottom-start` a todo el ancho en la hoja). Al hacer clic en un enlace, el script le añade `location.search` y `location.hash` de la página actual (U3). Escape y clic fuera cierran (popover nativo).

#### 7.10.2 Barra lateral

- `Sidebar.astro` pinta `<nav class="ac-sidebar" aria-label="Principal">` con: los enlaces de `top` («Inicio»); el grupo fijo «Destacados» (`p.ac-sidebar__heading` con el aspecto `ui-strong`, 700 sin mayúsculas, sin botón ni chevron: `DS:Sidebar`, `bundle.css:458-462`; `ui-caps` es solo el «Destacados» del Inicio) con sprites de 16 y `bounce` (el Diamond con `half`, fotograma 0, sin animación); y los grupos plegables, sin sprites.
- Cada grupo plegable es `<details>` con `<summary>` (botón con `ui-strong`, padding 8 0 y chevron de 16: arriba abierto, abajo cerrado) y su `<ul>` con borde izquierdo de 1 px. Se pliega sin JS y el navegador expone el estado expandido. Empieza abierto si contiene la página actual y cerrado si no. No se guarda el estado entre páginas.
- Página actual: el enlace cuya ruta es igual a `currentPath` lleva `aria-current="page"`. En una ruta hija sin entrada propia (una ficha de Pokémon; el detalle, el perfil o la página de publicar de Comercio), la entrada de su sección (Pokédex, Comercio) lleva `aria-current="true"` con el mismo aspecto (E10). Buscar, 404 y Cuenta no tienen entrada y no marcan ninguna. Nunca hay dos enlaces actuales.
- Desde 1280: `position: sticky` a 32 px bajo la cabecera, con desplazamiento propio (`max-height: calc(100dvh - var(--layout-header) - var(--space-32))`); el script en línea de §5.7 conserva su desplazamiento entre páginas. Por debajo de 1280 no se muestra.
- Los datos (`top`, grupos, enlaces y sprites) los fija §8.0.3. «Aportar al mapa» no se pinta (X1).

#### 7.10.3 Hoja móvil

- `MobileMenu.astro`: `<dialog id="menu-movil" aria-label="Menú" class="ac-mobile-menu">` con la fila de marca de 56 y el botón «Cerrar menú» (44), `LanguageMenu touch` y `Sidebar touch`, separados por líneas de 1 con 24 a cada lado.
- `scripts/mobile-menu.ts`: el botón de menú abre con `showModal()` (el resto de la página queda inerte, el foco va al botón de cerrar) y pone `aria-expanded="true"`; emite `ac:modal-open`. Cierran Escape (`cancel` nativo), el botón de cerrar y un clic en el velo (clic sobre el propio `dialog` fuera de la caja de la hoja). El evento `close` devuelve `aria-expanded="false"`; el foco vuelve al botón que la abrió. Si la ventana pasa a 1280 o más con la hoja abierta, se cierra.
- Sin desplazamiento de fondo: `html:has(#menu-movil[open]) { overflow: hidden }`. Entrada de la hoja `ac-sheet-in` de 500 ms y velo `::backdrop` en `overlay` con desenfoque de 4 px y fundido de 150 ms.

### 7.11 TOC con scroll-spy

- `Toc.astro`: `<aside aria-label="En esta página">` con el título «Resumen» (12/16 700 sobre una línea de 1) y una `<ol>` de enlaces `#id` con numeración decimal. Solo existe con 2 o más secciones; los `items` tienen los mismos ids, títulos y orden que los `Section` de la página (prueba de build en §14).
- En el HTML, el primer enlace lleva `aria-current="location"`.
- `scripts/toc-spy.ts` porta el algoritmo de la referencia: la sección actual es la última cuyo borde superior queda a 80 px o menos del borde de la ventana, con 1 px de tolerancia (cabecera de 64 más el `scroll-margin-top` de 16; §5.9); al final del documento (`innerHeight + scrollY ≥ scrollHeight − 1`) es la última; antes de la primera, la primera. Escucha `scroll` (pasivo, en captura) y `resize`, agrupados con `requestAnimationFrame`. Mueve `aria-current="location"`, que da el color `text-primary`.
- `Section` tiene `scroll-margin-top: 16px` y `html` reserva la cabecera con `scroll-padding-top` (§3.6). Saltar desde el índice deja el título a 16 px bajo la cabecera, a 80 px del borde de la ventana (V5-3).
- Desde 1280 el rail es `position: sticky` a 32 px bajo la cabecera; por debajo de 1280 no se muestra.

### 7.12 Destino de los componentes actuales

| Archivo actual | Destino | Quién lo ejecuta |
|---|---|---|
| `src/layouts/AppLayout.astro` | Se borra; lo sustituyen `PageLayout` y los componentes de 7.2.1. No pasan al marco nuevo: iconos lucide (`:14-29`), formulario de búsqueda (`:117-130`), indicadores falsos (`:143-158`), nota del Server Save (`:226-229`), `<details>` móvil (`:232-246`). | §8, al migrar la última página |
| `src/components/wiki/AllianceWordmark.astro` | Se borra; la marca es texto (`DS:Header`). | §7 (con `Header`) |
| `src/components/wiki/WikiSearch.tsx` | Se borra; `SearchTrigger` + `SearchPalette`. | §8 (Inicio) |
| `src/components/wiki/ContentSearch.tsx` | Se borra; la página Buscar usa `src/lib/search` y `EntityList` (R3). | §8 |
| `src/components/wiki/PokedexGrid.tsx` | Se borra; raíz de isla de la Pokédex con `EntityList`, `DexCard`, `EntitySlot` y `ListRow`. | §8 |
| `src/components/wiki/OutfitPreview.tsx` | Se conserva la lógica WebGL; su interfaz pasa a `ToggleGroup variant="sprite"` (Aura) y a los componentes del DS. | §8 |
| `src/components/sprites/*` | 7.4.5. | §7 |
| `src/components/trade/TradeDesk.tsx` | Se rehace con `ListingCard` y la lista de Comercio. | §9 |
| `src/components/tools/PokemonExplorer.tsx` | Se borra en F2, cuando la ruta pasa a marcador (§8.14) y la Tier list absorbe «Explorar tiers»; §11 construye la herramienta nueva en F5. | §8 |
| `src/components/tools/GuildRankingTool.tsx`, `tools/guild/GuildWorkspaceChrome.tsx`, `tools/GuildPersistencePanel.tsx` | Se rehacen con `DataTable`, `KpiCard`, `BarChart`, `Sparkline`, `PeriodFilter`, `Pagination` y `ToggleGroup`. | §10 |
| `src/components/phase3/ServerSaveStatus.tsx` | Sale del Inicio (A17, Q7); su badge «Temporal» (`:36-37`) no pasa a ningún componente. | §8, §12 |
| `src/components/map/MapExplorer.tsx` | Deja de renderizarse (R9). | §8 |
| `src/components/ui/button.tsx`, `input.tsx`, `kbd.tsx` | Se borran cuando se borren `WikiSearch`, `ContentSearch` y la herramienta de Guild actual (sus únicos consumidores). | §8, §10 |
| `src/components/ui/badge.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `sheet.tsx`, `tabs.tsx`, `textarea.tsx` | Se borran con la herramienta de Guild actual (único consumidor). | §10 |

### 7.13 Dependencias

- Se añade `@floating-ui/dom` (posición de tooltips, «+N», `Select`, `Combobox`, `LanguageMenu` y tooltip de la paleta). Versión fijada en `pnpm-lock.yaml`; peso y motivo en §3.8 (R17, E8).
- Ningún componente de §7 usa `@base-ui/react`, `class-variance-authority`, `cn` ni `tw-animate-css`. Su retirada del `package.json` y la de `components.json` se hacen en §3.10 cuando no quede consumidor (§3.8).
- `lucide-react` solo a través de `Glyph` (C-R7).

### 7.14 Criterios de aceptación de §7

§14 convierte cada fila en al menos una prueba.

| ID | Criterio |
|---|---|
| C7-01 | Cada componente de 7.2 existe en su ruta y su render coincide con la columna «Render»; una página sin lista ni herramienta solo descarga React para `SearchPalette`, en `client:idle` (7.3). |
| C7-02 | El marcado de cada componente tiene las clases `ac-*` de la referencia (comparación de clases por componente contra `bundle.js`). La comparación excluye los elementos que cambia la tabla de excepciones de C-R2 (`Sprite`; grupos de `Sidebar`; secciones de `GameTooltip`; `MobileMenu`; idioma y tema de `Header`; panel de `NestedEntity`; `PlusN`; listado de `Select`) y exige en su lugar el elemento que fija esa tabla. |
| C7-03 | `formatPokedolares`, `parsePokedolares` y `formatInteger` pasan la tabla de §4.3 y los casos de 7.8. |
| C7-04 | `gridKeys`, `listingLayout`, `lootKeys` y `trackCount` pasan los ejemplos de `DS:guias/30` y `CGS §5.3`; todas las tarjetas de una rejilla tienen el mismo `grid-row`. |
| C7-05 | `cellPlacement`, `frameForQuantity` y las firmas de animación pasan sus pruebas; cada sprite de píxel se dibuja a escala entera, salvo el Diamond del menú (S7). |
| C7-06 | Tooltip: TT1–TT13 en Playwright con ratón, teclado y toque emulado; puente de 7.5.6; como máximo un panel sin fijar y uno fijado, y fijar un segundo suelta el primero (TT8, TT9); Escape cierra los fijados; un panel más alto que la ventana a 390 × 844 se desplaza por dentro (S3). |
| C7-07 | Colocación: en `Lienzo:Comercio`, `Lienzo:Pokedex` y la ficha, los paneles de los hechos abren debajo y los de Held Items y el pie encima; ninguno tapa `[data-zone="head"]` de su tarjeta; ninguno sale de la ventana más allá de 8 px (16 a 390). |
| C7-08 | Cada `NestedEntity` tiene `aria-describedby` hacia un `role="tooltip"` existente; ningún `article`, `tr` ni tarjeta es disparador. |
| C7-09 | `DexCard` a 358 de contenedor: anatomía compacta sin JS, drops con tope 6 y «+N» cuadrado; a 944, tope de 3 chips; ningún elemento oculto es enfocable. |
| C7-10 | Listas: U1–U6, H1–H7, V1–V8 y PR1–PR5; una URL con estado abre ese estado tras hidratar; atrás y adelante recorren las páginas y un cambio de filtro no añade entradas al historial; la vista sobrevive a una recarga sin `view` en la URL; con una vista guardada o una URL con estado, la raíz lleva `data-ac-pending` en la primera pintura y ningún resultado del estado por defecto llega a verse. |
| C7-11 | Paleta: Ctrl + K y ⌘ + K abren y cierran; Escape devuelve el foco; ↑, ↓ e Intro funcionan; `rank.ts` pasa sus pruebas; un clic antes de hidratar abre la paleta al montarse. |
| C7-12 | Barra lateral: grupos plegables con teclado y sin JS; el grupo de la página actual empieza abierto; como mucho un `aria-current`; «Destacados» calcula `font-weight: 700` y `text-transform: none`. Hoja móvil: foco atrapado, Escape, velo y botón cierran, el foco vuelve y el fondo no se desplaza. |
| C7-13 | TOC: al desplazar, `aria-current="location"` sigue la regla de 7.11 (primera, intermedia y última al final del documento). |
| C7-14 | Con `prefers-reduced-motion: reduce`, 0 animaciones tras abrir un tooltip, la hoja y la paleta, y el Diamond en el fotograma 0 (S15). |
| C7-15 | Ningún archivo fuera de `Glyph.tsx` importa `lucide-react`; ningún componente importa `public/sprites/sprites.json`; solo `Sidebar` pasa `half` a `Sprite`. |

---

## 8. Páginas de la wiki

Esta sección fija, página por página, qué se construye en la fase F2 (§0): ruta y modo de render, tablero o plantilla, estructura, datos, estados, textos actuales que se quitan y criterios de aceptación. No cubre Comercio (§9), Guild (§10) ni Comparar Pokémon (§11). Los componentes (anatomía, medidas y comportamiento) están en §7 y en el DS; aquí solo se dice cuáles se usan, con qué datos y con qué textos. Los formatos de número y fecha, `<title>`, descripción, `canonical`, `hreflang` y `noindex` son de §13; las pruebas que ejecutan estos criterios, de §14. Cada «Se quita» remite a las filas de §12, que dan el texto actual y el final.

### 8.0 Reglas comunes

#### 8.0.1 Inventario de rutas

Todas existen en `/es/` y `/en/`. «Prerender» = `export const prerender = true`; «SSR» = `prerender = false`, render bajo demanda con el adaptador de Vercel. Las listas (Pokédex, Tier list, Ítems, Buscar) son páginas prerenderizadas con una isla de lista: su estado vive en la query y se aplica al hidratar, con el controlador de §7.7 (7.7.2 y 7.7.5).

| Ruta | Página | Render | Referencia | § | Hoy |
|---|---|---|---|---|---|
| `/` | Redirección 302 a `/es/` | configuración | — | 8.13 | `ROOT` (meta refresh prerenderizado) |
| `/{l}/` | Inicio | Prerender | `Lienzo:Main`, `Lienzo:Inicio-movil` | 8.1 | `HOME` |
| `/{l}/pokedex/` | Pokédex | Prerender + isla de lista | `Lienzo:Pokedex` | 8.2 | `IDX` |
| `/{l}/pokedex/{id}/` | Ficha de Pokémon | Prerender, un HTML por registro | `Lienzo:Pokedex-Shiny-Charizard` | 8.3 | `DET` |
| `/{l}/pokedex/tiers/` | Tier list | Prerender + isla de lista | `Lienzo:Pokedex` + DS | 8.8 | nueva |
| `/{l}/sistemas/` | Índice de Sistemas | Prerender | plantilla D | 8.4 | `SIS` |
| `/{l}/sistemas/{id}/` | Página de sistema | Prerender | `Lienzo:Sistema-Boost` | 8.4 | nueva |
| `/{l}/items/` | Ítems, «Todo» | Prerender + isla de lista | `Lienzo:Pokedex` + `Lienzo:Comercio` + DS | 8.5 | nueva |
| `/{l}/items/c/{categoria}/` | Ítems de una categoría del Market | Prerender (13) + isla de lista | ídem | 8.5 | nueva |
| `/{l}/buscar/` | Resultados de búsqueda | Prerender + isla de lista | DS + `RUB §2` | 8.6 | `BUS` |
| `/{l}/cambios/` | Cambios | Prerender | plantilla C + `DS:Timeline` | 8.7 | `CAM` |
| `/{l}/actividades/` | Índice de Actividades | Prerender | plantilla D | 8.9 | nueva |
| `/{l}/actividades/{id}/` | Página de actividad | Prerender | plantilla C | 8.9 | nueva |
| `/{l}/herramientas/` | Índice de Herramientas | Prerender | plantilla D | 8.10 | `TI` |
| `/{l}/mapa/` | Mapa (marcador, R9) | Prerender | plantilla E | 8.11 | `MI` |
| `/{l}/herramientas/pokemon/` | Comparar Pokémon, marcador hasta F5 (E18) | Prerender | plantilla E | 8.14 | `TPK` |
| cualquier otra | 404 | SSR (`src/pages/404.astro`) | plantilla E | 8.12 | página por defecto de Astro |

Redirecciones 302 (temporales: la ruta vieja puede volver con otro contenido). Se declaran en `astro.config.mjs` (`redirects`, §3.13), sin HTML intermedio, y aceptan la ruta con y sin barra final:

| Desde | Hacia | Motivo |
|---|---|---|
| `/{l}/mapa/aportar/` | `/{l}/mapa/` | A1. Se borra `AP`. |
| `/{l}/rotaciones/` | `/{l}/pokedex/tiers/` | La entrada del menú es «Tier list» (`Lienzo:Main`, grupo Pokémon); R15 lleva los tiers ahí. Se borra `ROT`. `/rotaciones/` vuelve cuando existan equipos por elemento (`docs/CONTENT_PLAN.md` H5, §15). |
| `/{l}/guias/` | `/{l}/actividades/` | El menú del lienzo no tiene «Guías»; las misiones viven en «Actividades» (A7). Se borra `GUI`. `/guias/` vuelve cuando exista la primera guía editorial (§15). |

La herramienta de `/{l}/herramientas/pokemon/` (§11, F5), `/{l}/herramientas/guild/` (§10) y `/{l}/comercio/` (§9) no se tratan aquí. Las rutas bajo `[locale]` solo se generan para `es` y `en`; `/xx/…` llega al 404 y nunca cae en `es` como hace hoy `getLocale` con un valor desconocido (`src/i18n/config.ts:76-78`). `pokedex/tiers` es una ruta estática que gana a `pokedex/[slug]`: `pnpm content:check` rechaza un `id` de Pokémon igual a `tiers` (§3.13).

#### 8.0.2 Plantillas

Una página sin tablero usa una de estas plantillas y solo componentes del DS (R16).

| Id | Composición (`DS:PageLayout`) | Páginas |
|---|---|---|
| A | `rail="spacer"`, `rhythm="home"`: `HomeIntro`, `SearchTrigger` (`home`), `FeaturedSection`, bento de `IndexPanel` + `WorldsTable`, `Footer`. Sin migas. | Inicio |
| B | `rail="spacer"` (columna 944): `Breadcrumb`, `PageTitle`, `FilterBar` o navegación de categorías, barra de resultados (`Count` + `ViewToggle`), la vista, `Pagination`, `Footer`. | Pokédex, Tier list, Ítems, Buscar |
| C | `rail={<Toc/>}` (columna 896) si la página tiene 2 o más secciones; con 0 o 1, `rail="spacer"` (columna 944), porque `DS:Toc` no se usa con una sola sección. `Breadcrumb`, `PageTitle` (con subtítulo opcional), párrafos de entrada, `InfoBanner` opcional, `Section` × n, `Footer`. | Ficha, página de sistema, Cambios, página de actividad |
| D | `rail="spacer"`: `Breadcrumb` (una miga), `PageTitle` y la rejilla de enlaces de `IndexPanel` sin franja de título (`IndexLinks`, §7.2.8) a todo el ancho: 4 columnas de enlaces con una columna principal de 900 o más (944, 992) y 2 por debajo (784, 736, 358), filas de 40 (44 con puntero grueso). Sin descripciones bajo los enlaces. | Sistemas, Actividades, Herramientas |
| E | `rail="spacer"`: `Breadcrumb` (salvo en 404), `PageTitle`, una línea (`EmptyState` o párrafo) y, en 404, búsqueda y Destacados. | Mapa, 404, Comparar Pokémon hasta F5 |
| F | `rail="spacer"` (columna 944): `Breadcrumb`, `PageTitle` con una línea de datos debajo (`ui`, `text-tertiary`), y desde 768 (`md:`) dos columnas: la ficha fija de `size-tt` (282) y, a `space-24`, el resto del ancho con `Section` × n a `space-24` entre sí; por debajo de 768, una columna con la ficha primero. `Footer`. | Detalle del anuncio (§9.6) |
| G | `rail="spacer"` (columna 944): `Breadcrumb`, `PageTitle` y, desde 768 (`md:`), dos columnas: el formulario y, a `space-24`, la vista previa de 304 con `position: sticky; top: calc(var(--layout-header) + var(--space-16))`; por debajo de 768, el formulario y después la vista previa. `Footer`. | Crear o publicar anuncio (§9.7) |
| H | `rail="spacer"` (columna 944), sin `Toc` aunque tenga 2 o más secciones (son herramientas, no artículos): `Breadcrumb` (salvo en Cuenta, sin grupo), `PageTitle`, fila de datos opcional (`FactLines`, 14/32) y `Section` × n. `Footer`. | Perfil del vendedor (§9.8), Cuenta (§9.9), Operaciones (§9.10), Moderación (§9.11) |

Medidas del marco a 1440, 1280, 1024, 768 y 390: S1 y `CGS §3`. Ritmo vertical: 48 entre bloques (24 en Inicio), `DS:PageLayout`. Los únicos puntos de corte de una plantilla son 768 (`md:`) y 1280 (`xl:`): ninguna página usa 1024, que solo existe dentro de `info-banner.css` (§5.4, `design:check` regla 5).

#### 8.0.3 Menú: enlaces de cada grupo (A4)

La barra lateral y la hoja móvil (`DS:Sidebar`, `DS:MobileMenu`) se construyen con estos datos. Un enlace solo existe si su ruta existe en el build (8.0.7, criterio WG5). Un grupo sin enlaces no se renderiza. Solo «Destacados» lleva sprites (16 px, rebote).

| Grupo `es` / `en` | Enlaces, en este orden | Fuente |
|---|---|---|
| (arriba) | «Inicio» / «Home» → `/{l}/` | fijo |
| «Destacados» / «Featured» (fijo, sin botón) | Las entradas de `content/destacados.json`, con su sprite | registro nuevo (8.1) |
| «Pokémon» | «Pokédex» → `/{l}/pokedex/`; «Tier list» → `/{l}/pokedex/tiers/`; «Comparar Pokémon» / «Compare Pokémon» → `/{l}/herramientas/pokemon/` (§11) | fijo |
| «Sistemas» / «Systems» | Una entrada por página de sistema, en el orden del registro (8.4) | `content/sistemas/` |
| «Ítems» / «Items» | «Todo» / «All» → `/{l}/items/` y las 13 categorías reales en el orden del Market → `/{l}/items/c/{id}/`, con la etiqueta del registro | `content/items/categorias.json` (`REG:90-92`) |
| «Actividades» / «Activities» | Una entrada por actividad publicada (8.9) | `content/quests.json` |
| «Herramientas» / «Tools» | «Guild» → `/{l}/herramientas/guild/` (§10); «Mapa» / «Map» → `/{l}/mapa/` | fijo |
| «Comunidad» / «Community» | «Comercio» / «Trade» → `/{l}/comercio/` (§9); «Cambios» / «Changes» → `/{l}/cambios/` | fijo |

«Aportar al mapa» no existe (A1, X1). Las etiquetas de los tableros para Sistemas, Ítems y Actividades son muestras (X4): las que se ven salen de los registros.

#### 8.0.4 Migas (`DS:Breadcrumb`)

- Toda página que pertenece a un grupo del menú lleva migas: grupo › página (› subpágina). La última es la página actual, sin enlace y con `aria-current="page"`.
- La miga de grupo enlaza al índice del grupo si existe (Sistemas → `/{l}/sistemas/`, Ítems → `/{l}/items/`, Actividades → `/{l}/actividades/`, Herramientas → `/{l}/herramientas/`). «Pokémon» y «Comunidad» no tienen índice: su miga es texto con el mismo aspecto, sin enlace ni subrayado. Nunca `href="#"`.
- En el índice de un grupo, las migas son una sola miga, la actual (T15).
- Inicio, Buscar y 404 no pertenecen a ningún grupo y no llevan migas (E4).

#### 8.0.5 Datos, vacíos y menciones

- **Solo registros (R7, X4).** Toda cifra, etiqueta de dato y conteo sale de `content/` o de `public/sprites/sprites.json`, leída en el servidor con las funciones de `REPO` y `REG` o con las que añada §3.13. Ningún texto ni cifra de un tablero pasa a `src/` ni a `content/`: los datos del tablero existen solo en el fixture de paridad de `tests/` (§14).
- **Registros nuevos de esta sección** (forma exacta, esquema, carga y `pnpm content:check` en §3.13, «Forma de los registros»): `content/destacados.json` (8.1), `content/mundos.json` (8.1), `content/sistemas/` (8.4), `content/cambios.json` (8.7), `content/elementos.json` (el «registro de elementos» de `elementTip`, §7.5.3, con los `id` de la tabla siguiente) y los campos nuevos de Pokémon (`hp`, `experiencia`, `drops`, `evolucion`, `habilidades`, `donde`, `elementoMoveset`), de ítems (`elemento`, `uso`), de ítems de sistema y de actividades (`sprite`). Mientras un campo no exista en el registro, su zona, fila, columna o sección no se renderiza.
- **Vacíos (R7, T32).** En tarjetas, tablas y listas: claves = unión del resultado (`CGS §5.3`); «—» donde falta un valor que otras filas sí tienen; la clave que ninguna fila tiene desaparece. En el tooltip y en la ficha fija, la fila sin valor se omite. Nunca «0», «N/D», «No informado» ni «Desconocido».
- **Borradores.** Un registro `"borrador": true` se muestra, salvo con `OCULTAR_BORRADORES=1` (`REG:48-55`). La interfaz nunca marca un registro como borrador.
- **Menciones (R2).** Una mención es `NestedEntity` solo si la entidad tiene registro y al menos una fila de tooltip. Si no, es texto sin enlace. Sin página propia de la entidad (ítems en este corte, §15), el disparador es `<button type="button">`; con página, `<a href>`.
- **Idioma.** Los términos del juego y los nombres propios no llevan `lang` (T23, Q3). Una frase de un registro que solo existe en inglés se muestra en la página `es` con `lang="en"`; la que solo existe en español se muestra en la página `en` con `lang="es"` (T22).
- **Elementos.** Etiqueta por idioma, en el orden del panel Pokédex de `Lienzo:Main`, que es el orden de todo filtro y lista de elementos:

| `id` | `es` | `en` |
|---|---|---|
| `normal` | Normal | Normal |
| `fire` | Fuego | Fire |
| `water` | Agua | Water |
| `grass` | Planta | Grass |
| `electric` | Eléctrico | Electric |
| `ice` | Hielo | Ice |
| `fighting` | Lucha | Fighting |
| `poison` | Veneno | Poison |
| `ground` | Tierra | Ground |
| `flying` | Volador | Flying |
| `psychic` | Psíquico | Psychic |
| `bug` | Bicho | Bug |
| `rock` | Roca | Rock |
| `ghost` | Fantasma | Ghost |
| `dragon` | Dragón | Dragon |
| `fairy` | Hada | Fairy |
| `dark` | Siniestro | Dark |
| `steel` | Acero | Steel |

- **Campos de Pokémon** (`content/pokemon.json`) y cómo se escriben: «Requisito» = `nivel` como «Nivel {n}» (en `en`, «Requirement» y «Level {n}»: §13.3, Q5); «Tier» = `formatTier` (`src/lib/content/format.ts:5-8`, «T3», «Legendary», «ULTIMATE»; su «—» interno solo se usa donde 8.0.5 permite «—»); «Rol» = `funcion` («PVE», «PVP»); «Variante» = «Normal» o `ShinyMark` + «Shiny»; «Elementos» = etiquetas de la tabla anterior, unidas con « / » en el tooltip («Fuego / Volador»); «Generación» = `generacion`; «Nº» = `numero`. Arte: `resolvePokemonImage` (`src/lib/content/pokemon-media.ts:3-7`), escala suave (T29).
- **Orden de Pokémon en toda lista:** `numero` ascendente (nulos al final), `normal` antes que `shiny`, después `nombre` con `localeCompare` del idioma.

#### 8.0.6 Listas: configuración de cada una

El estado, la URL, la historia, la vista guardada y el primer render son los de §7.7 (U1–U6, H1–H7, V1–V8, PR1–PR5). Esta sección solo fija lo que §7.7 deja a cada lista (`ListConfig`):

| Lista (`id`, clave de vista `ac:vista:<id>`) | Página | `pageSize` | Filtros (clave: valores) | `groupBy` |
|---|---|---|---|---|
| `pokedex` | 8.2 | 12 | `gen`: entero; `tier`: `t1`…`t7`, `super-rare`, `ultra-rare`, `legendary`, `mythic`, `ultimate`; `elemento`: `id` de 8.0.5; `variante`: `normal`, `shiny` | generación, solo en Slots |
| `tiers` | 8.8 | 48 | `gen`, `elemento`, `variante` como `pokedex` | tier, en Cards y Slots |
| `items` | 8.5 | 24 | ninguno (la categoría es la ruta) | categoría del Market, solo en «Todo» |
| `buscar` | 8.6 | 24 | `q` | grupo del índice (8.6) |
| `drops` | 8.3 | todos (sin paginación) | ninguno | ninguno |
| `familia` (`defaultView: 'list'`, E15) | 8.3 | todos (sin paginación) | ninguno | ninguno |
| `sistema-items` | 8.4.2 | todos (sin paginación) | ninguno | ninguno |

Todas tienen un solo orden (sin `SortSelect`, V6). La paginación se aplica antes de agrupar (`CGS §2.1`). En estas páginas no hay sección alrededor de la lista, así que los encabezados de grupo son `h2` (`CardGroup level={2}`) y el título de cada tarjeta es `h3`; sin grupos, `h2` (`headingLevel`, 7.6.2). Las tres listas de la ficha y de la página de sistema van dentro de su `Section` h2: títulos de tarjeta `h3`. Datos: `pokedex` y `tiers` leen `/{l}/pokedex/datos.json` e `items` lee `/{l}/items/datos.json` (PR5); `buscar`, el índice de 7.9.1; `drops`, `familia` y `sistema-items` reciben sus pocas filas en las props. Los valores de la URL son identificadores, nunca etiquetas (U3): `/es/pokedex/?elemento=fire&variante=shiny&view=slots&page=2` sirve en los dos idiomas. Las listas de la ficha llevan `prefix` (`drops`, `familia`) para no compartir parámetros (U1).

#### 8.0.7 Protocolo de aceptación (se aplica a cada página)

Cada página enumera sus criterios con estos identificadores; §14 los automatiza.

| Id | Criterio |
|---|---|
| WG1 | **Marco:** S1 a 1440 × 900 y S1 a 390. 0 desbordamiento horizontal del documento a 390 (`documentElement.scrollWidth ≤ 390`); una tabla ancha se desplaza dentro de su borde (`DataTable scroll`). |
| WG2 | **Geometría frente al tablero** (páginas con tablero; §14.5, punto 1): con los datos de paridad del tablero, a su ancho, cada rejilla que registra `render.mjs <tablero> --measure` existe en la página con el mismo número de columnas y de hijos, `rect` a ±1 px y la altura de cada fila a ±1 px; dispersión por fila 0 (S2). |
| WG3 | **Imagen frente al tablero** (páginas con tablero; §14.5, punto 2; proyecto `visual` en Windows con Verdana): recortes de la página con los datos de paridad, a la anchura y altura del tablero y con animaciones desactivadas, frente a `render.mjs <tablero>` con `"tip": null` y las máscaras de desviación de §14.5. Los recortes de página no incluyen la cabecera ni, a 1440, la barra lateral: las prueba §7. Umbral por píxel 0,15 y como máximo 1 % de píxeles distintos. |
| WG4 | **Sin tablero:** composición igual a su plantilla de 8.0.2; rejillas según `DS:guias/30 §Responsive` a 1440, 1280, 1024, 768 y 390 (S2). |
| WG5 | **Enlaces reales:** cada `a[href]` interno del HTML de la página responde 200, o 302 hacia una ruta que responde 200 (8.0.1). 0 `href="#"`, 0 `href=""` y 0 enlaces a rutas retiradas. |
| WA1 | **axe:** S12 en `es` y `en`, repetido con un tooltip abierto y con la hoja móvil abierta. |
| WA2 | **Estructura:** un solo `h1`; niveles de encabezado sin saltos, también de `h1` a los títulos de tarjeta de una lista sin grupos (`headingLevel`, 7.6.2); `main#contenido` destino de «Saltar al contenido»; landmarks con nombre (`nav` de migas «Migas de pan» / «Breadcrumb», menú, `Toc` «En esta página» / «On this page»). Cada tabla tiene `caption`. |
| WA3 | **Teclado y táctil:** S13 y S14. Cada toggle lleva `aria-pressed`; la entrada del menú de la ruta, si la tiene, `aria-current="page"` (`"true"` la de su sección en una ruta hija, E10; ninguna en Buscar, 404 y Cuenta); la página actual de la paginación y la pestaña actual de Ítems, `aria-current="page"`; el índice, `aria-current="location"`. |
| WA4 | **Idioma:** en `es`, todo nodo de texto de un registro cuyo único texto es inglés está dentro de un elemento con `lang="en"`, y al revés en `en` (8.0.5). |
| WL1 | **Sin relleno:** para cada fila de §12 que cita el «Se quita» de la página, el texto «Actual» de una fila BORRAR no aparece en el HTML `es` ni `en` de esa página: como contenido completo de un nodo de texto (tras recortar espacios) si es texto visible, o como valor del atributo citado (`aria-label`, `alt`, `title`, `placeholder`). El texto final de una fila REESCRIBIR aparece. El texto que llega de un registro no cuenta. 0 coincidencias de la lista prohibida de §12.22. 0 iconos lucide fuera de los glifos utilitarios (S7). |
| WD1 | **Datos:** cada cifra y conteo visible es igual al valor calculado del registro en una prueba unitaria; cambiar el registro de prueba cambia la cifra (S19). |

### 8.1 Inicio (`/{l}/`)

**Tablero:** `Lienzo:Main` (1440) y `Lienzo:Inicio-movil` (390). **Plantilla:** A. **Render:** prerender.

**Estructura a 1440**
1. `HomeIntro`: sprite de 16 a 3x (48, `aria-hidden`), clave `ui/inicio` (§3.13; sin ella, la caja queda vacía). h1 «Bienvenido a Alliance Codex» / «Welcome to Alliance Codex». Línea: «{n} variantes de Pokémon, {lista} de PokeAlliance.» / «{n} Pokémon variants, {list} from PokeAlliance.», donde `n` = `getPokemon().length` (`REPO:71-73`) y `{lista}` une, en este orden y solo si su registro tiene al menos un registro publicado, «ítems» / «items», «sistemas» / «systems» y «actividades» / «activities», con «y» / «and» antes del último. Ejemplo con todo publicado: «910 variantes de Pokémon, ítems, sistemas y actividades de PokeAlliance.» (X12, pendiente de Q13).
2. `SearchTrigger variant="home"`: «Busca Pokémon, ítems, sistemas…» / «Search Pokémon, items, systems…», tecla «Ctrl + K». Abre la paleta (8.6). La cabecera del Inicio no lleva buscador (A3).
3. `FeaturedSection` «Destacados» / «Featured»: una `FeaturedCard` por entrada de `content/destacados.json` (1 a 4 entradas; cada una: etiqueta `es`/`en`, ruta del sitio y clave de sprite). Rejilla 4, 2 o 1 columnas (`CGS §6.4`). Las mismas entradas forman el grupo «Destacados» del menú.
4. Bento (`CGS §6.5`, E17), en este orden del DOM, que es el de una columna:
   - `IndexPanel` «Sistemas» / «Systems» (área `sistemas`, cabecera `ui/indice/sistemas`): una entrada por página de sistema (8.4), con su sprite y, si el registro trae filas de tooltip, `tip`. Conteo = número de enlaces, con « páginas» / « pages» para lector de pantalla.
   - `IndexPanel` «Ítems» / «Items» (área `items`, `ui/indice/items`): «Todo» / «All» y las 13 categorías del Market en su orden, con el `icono` de cada categoría (`ui/categorias/{id}`). Conteo 14, « páginas».
   - `IndexPanel` «Actividades» / «Activities» (área `actividades`, `ui/indice/actividades`): una entrada por actividad publicada (8.9), sin tooltip. Conteo, « páginas».
   - `IndexPanel` «Pokédex» (área `pokedex`, `ui/indice/pokedex`, `span={2}`): los 18 elementos en el orden de 8.0.5, cada uno → `/{l}/pokedex/?elemento={id}`, con su icono de elemento a 24 (suave); un elemento sin icono conserva la celda de 32 vacía. Conteo 18, « elementos» / « elements».
   - `WorldsTable` (área `mundos`): mundos de `content/mundos.json` (`nombre`). Solo la columna «Mundo» / «World», sin botón de orden, filas por nombre con orden numérico (X3, §7.2.7): «Moon, Sun, Titan 1, Titan 2, Titan 3». h2 oculto «Mundos» / «Worlds».
   - Colocación: `src/styles/components/home-bento.css` (capa `components`) es una rejilla con `container-type: inline-size` y columnas de la familia `index` (7.6.1). Con `grid-template-areas` por container query coloca los paneles como `CGS §6.5`: 3 columnas, `"sistemas items mundos" "actividades pokedex pokedex"`; 2 columnas, `"sistemas items" "actividades mundos" "pokedex pokedex"`; 1 columna, el orden del DOM. Así Mundos queda 3.º, 4.º o último sin `order` ni duplicar la tabla.
   - La tabla de Mundos no tiene elementos enfocables mientras no traiga «En línea» (X3), así el orden de tabulación coincide con el visual en los tres anchos: Sistemas, Ítems, Actividades, Pokédex. Cuando `WorldsTable` tenga botones de orden (§15), esta colocación se revisa.
   - Un panel con 0 enlaces (o la tabla con 0 mundos) no se renderiza; su área queda sin celda y las demás no se mueven de área. Si sobra una fila vacía, la rejilla usa la plantilla de áreas sin esa fila (una plantilla por combinación de paneles presentes, calculada en el frontmatter y escrita como propiedad `--ac-areas-3`, `--ac-areas-2` en el elemento).
5. `Footer`.

**A 390 (`Lienzo:Inicio-movil`):** `HomeIntro` sin sprite; `SearchTrigger variant="mobile"` (44, sin tecla); Destacados en 1 columna; paneles en 1 columna con filas de 44, el de Pokédex con 2 columnas de enlaces; `WorldsTable` al final con `rowHeight={44}`. Cabecera: marca y menú (sin botón de tema, X2).

**Datos:** `getPokemon` (`REPO:71-73`); `getCategorias` (`REG:90-92`); `getQuests` (`REPO:87-89`); `content/destacados.json`, `content/mundos.json`, `content/sistemas/` y `content/elementos.json` (8.0.5).

**Estados**
- Todo se resuelve en el build: no hay estado de carga.
- Vacío: cada panel desaparece sin sus datos (paso 4). Sin entradas en `destacados.json` no hay sección Destacados.
- Error: un registro inválido o una entrada de Destacados cuya ruta no existe detienen el build (`pnpm content:check`, §3.13). La paleta tiene sus propios estados (8.6).

**Se quita:** H-01 a H-11 (§12.4). Los pasos 1 y 2 sustituyen el h1 y el buscador actuales; Destacados y el bento sustituyen «Explorar la wiki» y sus cuatro tarjetas; `ServerSaveStatus` sale del Inicio (A17, Q7).

**Aceptación:** WG1; WG2 y WG3 contra `Main` (1440, `{"tip":null}`) y `Inicio-movil` (390, `{"tip":null}`), con dos diferencias declaradas que el fixture no puede reproducir: el panel Ítems siempre tiene las 14 categorías del Market, que el esquema fija (7 filas de enlaces frente a las 5 de muestra), y `WorldsTable` no tiene la columna «En línea» (X3). Por eso:
- WG2 a 1440: Destacados en (248, 268, 944 × 62), 4 columnas; bento en x 248 con 944 de ancho y 3 columnas; primera fila del bento de 355 de alto (franja 44 + borde 1 + relleno 16 + 7 × 40 + 6 × 2 + bordes 2) y segunda fila de 271, como el tablero; filas de enlaces de 40.
- WG2 a 390: Destacados en (16, 256, 358 × 272), 1 columna; panel Ítems de 383 (7 × 44); Sistemas y Actividades de 291, Pokédex de 475 y `WorldsTable` de 267, como el tablero; filas de enlaces de 44.
- WG3 compara la región desde la cabecera hasta el borde superior del bento (y < 354 a 1440, y < 544 a 390), con la línea de `HomeIntro` enmascarada (DV6: «actividades» frente a «guías», X12). El bento queda cubierto por WG2 y por las pruebas de `IndexPanel` y `WorldsTable` de §7.
- IN4: a 1440 (3 columnas), 1280 (2) y 390 (1), el orden visual de los paneles es el de `CGS §6.5` (Mundos 3.º, 4.º y último), el DOM es Sistemas, Ítems, Actividades, Pokédex, Mundos, y ningún panel lleva `order` ni `grid-row`/`grid-column` en línea.

WG5; WA1–WA4; WL1; WD1 para `n`, los tres conteos de páginas y el conteo 18. Además:
- IN1: Ctrl + K y Cmd + K abren la paleta con el foco en su campo; Escape la cierra y devuelve el foco al disparador.
- IN2: con `destacados.json` de 3 entradas hay 3 `FeaturedCard` y una celda vacía al final de la fila a 1440.
- IN3: sin registros de actividades no existe el panel Actividades ni su `h2`.

### 8.2 Pokédex (`/{l}/pokedex/`)

**Tablero:** `Lienzo:Pokedex`. **Plantilla:** B. **Render:** prerender con la isla de lista `pokedex` (`client:load`, 8.0.6).

**Estructura**
1. Migas «Pokémon › Pokédex».
2. `PageTitle` «Pokédex», sin subtítulo.
3. `FilterBar layout="fill"`: `Select` «Generación» / «Generation» (opciones: «Todas» / «All» y cada `generacion` presente, ascendente); `Select` «Tier» («Todos» / «All», T1…T7 y después los tiers especiales en el orden de `$defs.tierEspecial` de `content/schemas/pokemon.schema.json`, solo los presentes); `Select` «Elemento» / «Element» («Todos» / «All» y los 18 de 8.0.5; coincide si el Pokémon tiene ese elemento entre los suyos); `ToggleGroup` «Variante» / «Variant»: «Todas» / «All», «Normal», «Shiny» (con `ShinyMark`). No hay campo de búsqueda: el nombre se busca con Ctrl + K (E3, A22, 8.6).
4. Barra de resultados: `Count` a la izquierda y `ViewToggle` a la derecha. Texto del conteo según Variante: Todas «{n} variantes» / «{n} variants» (1: «1 variante» / «1 variant»); Normal «{n} normales» / «{n} normal» (1: «1 normal»); Shiny «{n} Shiny». `n` es el total filtrado, no el de la página.
5. Resultados, 12 por página (`Lienzo:Pokedex`: 76 páginas para 910), en las tres vistas (8.0.6):
   - **Cards:** `CardGrid family="pokedex" headingLevel={2}` de `DexCard` (lista sin grupos bajo el h1, 7.6.2). Cabeza: arte de 64, nombre (enlace a la ficha), «Nº {n} · Generación {g}» / «No. {n} · Generation {g}» (cada parte solo si existe). Hechos: Requisito, Tier, Rol, Variante, las de la unión de la página (`dexLayout`). Chips de elemento (`NestedEntity` si el diccionario trae filas: «Stone:», «Fragment:»). Zona «Drops» solo si algún Pokémon de la página tiene drops en el registro (`CGS §5.3`).
   - **Slots:** `SlotsPanel layout="stacked"` agrupado por generación («Generación 1» / «Generation 1») y, sin generación, un último grupo «—»; `EntitySlot size={72}` con el arte a 64, `ShinyMark` en los Shiny, enlace a la ficha y tooltip con «Requisito:», «Tier:», «Elementos:», «Generación:», «Rol:» (en este orden, `Lienzo:Pokedex`).
   - **Lista:** `DataTable` con `caption` «Pokédex, todas las variantes» / «Pokédex, variantes normales» / «Pokédex, variantes Shiny» (en: «Pokédex, all variants» / «normal variants» / «Shiny variants») y columnas Sprite (solo lector) · «Nº» · «Nombre» / «Name» · «Elementos» / «Elements» · «Tier» · «Requisito» · «Rol» / «Role» · «Variante» / «Variant»; filas `ListRow variant="pokedex"` con el mismo tooltip que Slots.
6. `Pagination align="center"`, solo con más de una página.
7. `Footer`.

**A 390:** `FilterBar` con un filtro por fila; Cards compactas 2 × 175 con separación 8 (`CGS §6.2`); slots de 72 que saltan de línea; la tabla se desplaza dentro de su borde.

**Datos:** `getPokemon` (`REPO:71-73`), orden de 8.0.5; `formatTier`; `resolvePokemonImage`; `content/elementos.json`; `drops` (campo nuevo, §3.13). El HTML trae la primera página y el resto llega de `/{l}/pokedex/datos.json` (PR5): hoy la isla serializa las 910 entradas en su atributo `props` (457.633 B de los 519.525 B del HTML, build del 2026-09-19). `getPokemonOutfit` ya no se usa en la lista (hoy `IDX:36`, `:49`).

**Estados**
- Vacío por filtros (V7): la barra se queda con «0 variantes» / «0 variants» y la lista pasa a `EmptyState` «No hay Pokémon que coincidan con estos filtros.» / «No Pokémon match these filters.» con acción «Limpiar filtros» / «Clear filters», un enlace a `/{l}/pokedex/`. Sin paginación.
- Carga: el HTML trae la página 1 sin filtros; el estado de la URL o la vista guardada se aplican al hidratar, con la lista oculta y su altura reservada hasta entonces (PR1, PR4). Arte remoto que no carga: la marca de sprite faltante en su caja, sin inicial de respaldo (§7.4.4).
- Error: un parámetro inválido cae al valor por defecto (U4); un registro inválido detiene el build.

**Se quita:** P-01 a P-29 (§12.7) y las migas «Inicio / Pokédex» (B-04), que pasan a «Pokémon › Pokédex». Los pasos 3 a 6 sustituyen la isla `PokedexGrid` (buscador, atajo «/», «Mostrar más Pokémon» de 48 en 48).

**Aceptación:** WG1; WG2 y WG3 contra `Pokedex` a 1440 con `{"tip":null}` en `view` = `cards`, `slots` y `list` y en `variant` = `all`, `normal` y `shiny` (9 estados); la rejilla de Cards en (248, 395, 944 × 1324), 3 columnas, filas 326/326/326/298 con el fixture. WG5 (incluido cada enlace de `Pagination`); WA1–WA4; WL1; WD1 para el conteo y el número de páginas. Además:
- PX1: `/es/pokedex/?elemento=fire&variante=shiny` muestra, tras hidratar, solo Shiny con Fuego, y el conteo es el de ese filtro sobre el registro.
- PX2: con 13 resultados hay 2 páginas; `?page=9` muestra la 2 y la URL se reescribe a `?page=2` (U4).
- PX3: tras elegir Slots y recargar, la vista es Slots (S4, U6).
- PX4: 0 escuchas de `keydown` para «/» (A22).
- PX5: el enlace «Fuego» del panel Pokédex del Inicio lleva a esta página con el filtro Elemento en «Fuego».

### 8.3 Ficha de Pokémon (`/{l}/pokedex/{id}/`)

**Tablero:** `Lienzo:Pokedex-Shiny-Charizard`. **Plantilla:** C, con `preloadGameFont` (la ficha fija pinta Poppins al cargar, §3.9). **Render:** prerender, un HTML por registro de `content/pokemon.json` y por idioma. Un `id` desconocido responde 404 (8.12).

**Estructura**
1. Migas «Pokémon › Pokédex › {nombre}».
2. `PageTitle` `{nombre}` con subtítulo «Nº {numero}» / «No. {numero}» (sin subtítulo si `numero` es nulo).
3. Fila de cabeza (`CGS §6.8`, una sola altura):
   - Panel de arte: el arte del registro, suave, `alt=""` (el nombre está en el h1 y en la ficha). Sin imagen o si no carga: la marca de sprite faltante.
   - Ficha fija: `GameTooltip` fijo (`role="group"`, `aria-label` «Ficha de {nombre}» / «{name} sheet» (§7.5.9), sin franja inferior, sin animación; `DS:guias/10 §Variantes`). Cabeza con el arte a 70 y `tt-shiny` en los Shiny. Filas en este orden y solo con valor: «Requisito:», «Tier:», «Elementos:», «Rol:», «HP:», «Experiencia:», «Generación:» (en: «Tier:», «Elements:», «Role:», «HP:», «Experience:», «Generation:»; «Requisito:» en `en` según §13).
   - Panel de outfit (solo si `getOutfitForPokemon` devuelve registro, `REG:115-117`): el frame idle `sur` de 64 a 2x (128) en un panel de 176 (R18), con el aura elegida dibujada por su shader y, con un aura activa, su ball de 32 arriba a la derecha (`role="img"`, `aria-label` «Aura {nombre}» / «{name} aura»). Sin selector de dirección (X11, Q11).
   - `ToggleGroup variant="sprite" direction="column" strong` «Aura»: «Ninguna» / «None» y una opción por aura de `getAuras()` (`REG:119-121`) con su `icono` y su `nombre`. Opción inicial: la primera aura del registro (hoy Alliance, como el tablero). Solo con panel de outfit.
4. Secciones, cada una solo si hay datos, con su entrada en el `Toc` «Resumen» / «Summary»:
   - **«Drops»** (`id="drops"`, lista `drops` de 8.0.6): una fila por entrada de `drops` del registro. `Count` «{n} drops» (1: «1 drop»), `ViewToggle` con `ariaLabel` «Vista de drops» / «Drop view». Cards: `CardGrid family="loot"` de `LootCard` (títulos `h3`) con claves de la unión en el orden Drop de, Elemento, Uso, Cantidad, Precio NPC (en: «Dropped by», «Element», «Use», «Quantity», «NPC Price»): «Drop de» calculado como en `itemTip`, «Elemento» y «Uso» del ítem, «Cantidad» de `drops[].cantidad` («2» o «1 a 3» / «1 to 3») y «Precio NPC» de `precioNpc.vende` del ítem. Slots: `SlotsPanel` de una lista, `EntitySlot size={40}` (44 táctil). Lista: `DataTable` `caption` «Drops de {nombre}» / «{name} drops», columnas Sprite · «Ítem» / «Item» · «Drop de» · «Elemento» · «Uso». Cada drop es un ítem del registro; el título de la tarjeta es texto (no hay página de ítem, §15) y en Slots y Lista el disparador es un botón. «Drop de» con un solo Pokémon enlaza a su ficha con su tooltip.
   - **«Tier list»** (`id="tier-list"`, lista `familia` de 8.0.6, E15): la línea evolutiva con sus variantes si existe `evolucion`; sin él, los registros con el mismo `numero`. La sección existe con 2 entradas o más. `Count` «{n} variantes» / «{n} variants» y `ViewToggle` con `ariaLabel` «Vista de la Tier list» / «Tier list view»; vista por defecto Lista (E15).
     - **Lista** (la tabla del tablero): `DataTable` con columnas «Pokémon», «Tier» y «Moveset» (la columna solo si alguna fila trae `elementoMoveset`), `caption` «Tier list de la familia de {primera etapa}» / «Tier list of the {first stage} family» con evolución, o «Variantes de Nº {numero}» / «No. {numero} variants» sin ella. Cada nombre es un `ListRow` con el tooltip de `pokemonTip`.
     - **Cards:** `CardGrid family="pokedex"` de `DexCard` (títulos `h3`), como 8.2. **Slots:** `SlotsPanel` de una lista con `EntitySlot size={72}`, como 8.2.
     - La entrada de la página actual, en las tres vistas: sin enlace ni tooltip, con `aria-current="page"` en su nombre, en negrita en Lista.
   - **«Evolución» / «Evolution»** (`id="evolucion"`): `EvolutionChain` con los requisitos e ítems del registro; la etapa actual con `aria-current="page"`.
   - **«Ataques» / «Moves»** (`id="ataques"`): `DataTable` `caption` «Ataques de {nombre}» / «{name} moves», columnas «Slot», «Ataque» / «Move», «Cooldown», «Elemento» / «Element». Filas: los registros de `getMoves()` (`REPO:79-81`) cuyo `pokemon` incluye el `id`, ordenados por `slot` con orden natural (M1, M2… M10). Cooldown «{n} s». Elemento: chip con el nombre de `content/elementos.json`; `moves.elemento` se normaliza al `id` de elemento (§3.13). Dentro, h3 «Habilidades» / «Abilities» con chips, solo si el registro trae habilidades.
   - **«Dónde encontrarlo» / «Where to find it»** (`id="donde"`): una línea por clave de `donde` con datos, como en el tablero: «Hunts de {especie}:» (`hunts`), «Linked Tasks:» (`linkedTasks`), «Equipos de NPC:» (`equiposNpc`) (en: «{species} hunts:», «Linked Tasks:», «NPC teams:»), cada valor una lista separada por « · »; cada `EnlaceDato` con `ref` y registro es un `NestedEntity` con su tooltip, y los demás, texto (R2).
5. `Footer`.

Sin secciones, la página termina en la fila de cabeza. Con una sola sección no hay `Toc` y la columna mide 944 (8.0.2).

**A 390:** la fila de cabeza pasa a columna (arte, ficha de 282, outfit y Aura en fila); las tablas se desplazan dentro de su borde; `EvolutionChain` se desplaza dentro de su contenedor (`DS:EvolutionChain`).

**Datos:** `getPokemon`, `getPokemonById` (`REPO:71-77`); `getOutfitForPokemon`, `getAuras` (`REG:115-121`); `getMoves` (`REPO:79-81`); campos nuevos de 8.0.5.

**Estados**
- Sin outfit: ni panel de outfit ni Aura.
- WebGL no disponible: el outfit se ve sin aura, las opciones de Aura quedan deshabilitadas y debajo del panel aparece «El aura no está disponible en este navegador.» / «Aura preview isn't available in this browser.» (D-12)
- El outfit no carga: la marca de sprite faltante de 64 en el panel, sin texto.
- Carga: ninguna (HTML estático); el shader arranca al entrar el panel en pantalla.

**Se quita:** D-01 a D-16 (§12.8), P-13, P-21, P-22 y P-24 (§12.7) en sus líneas de `DET`, y las migas «Inicio / Pokédex / {nombre}» (B-04), que pasan a «Pokémon › Pokédex › {nombre}». La redirección de `DET:23` cede al 404 (8.12). Salen el paginador y «Volver a la Pokédex» (X11); el título «Resumen» del `Toc` es otra pieza y se conserva. `OutfitPreview` pasa al panel de outfit y Aura del paso 3.

**Aceptación:** WG1; WG2 y WG3 contra `Pokedex-Shiny-Charizard` a 1440 con `{"tip":null}` y `dv` = `cards`, `slots` y `list`, y `aura` = `none`, `alliance` y `premier`, con la Tier list en su vista por defecto (Lista, la del tablero); la rejilla de drops en (248, 675, 896 × 308), 3 columnas, filas de 146. WG5; WA1–WA4; WL1; WD1. Además:
- FI1: existe un HTML por registro y por idioma (1.820 con el registro actual de 910) y `/es/pokedex/no-existe/` responde 404.
- FI2: con el registro actual, `articuno` no tiene secciones; `charizard` tiene solo «Tier list», con `caption` «Variantes de Nº 6» y las filas Charizard (T3) y Shiny Charizard (T1); `chimchar` tiene solo «Ataques», con la fila «M1 · Scratch · 12 s · Normal». Ninguna de las tres lleva `Toc` y su columna mide 944.
- FI3: la ficha fija no contiene «—»; una fila cuyo valor es nulo no existe.
- FI4: con reducción de movimiento, el aura se dibuja quieta y `document.getAnimations().length === 0` (S15).
- FI5: en `charizard`, la Tier list abre en Lista; al elegir Cards y Slots muestra las mismas 2 variantes en el mismo orden, la vista elegida sobrevive a una recarga (`ac:vista:familia`) y la entrada de Charizard no tiene enlace, tooltip ni `aria-describedby` en ninguna vista.

### 8.4 Sistemas: índice y página de sistema

`Lienzo:Sistema-Boost` es la plantilla de toda página de sistema: sus bloques se generan desde el registro, nunca a mano por página.

**Registro** (`content/sistemas/`, esquema y carga en §3.13). La página necesita por sistema: `id` (slug), `titulo` y `subtitulo` por idioma (subtítulo opcional, el del tablero es «(Potenciación)»), clave de `sprite`, `orden`, filas de tooltip (etiqueta y valor por idioma), `intro` (bloques `parrafo`), `banner` opcional (clave de sprite y de 1 a 4 datos por idioma), `secciones` (cada una `id`, `titulo` por idioma y bloques) y `borrador`.

Bloques y cómo se dibujan (todos dentro de su `Section`, a 16 entre sí):

| Bloque | Componente | En el tablero |
|---|---|---|
| `parrafo` | `<p>` justificado (`body`) con elementos en línea | entrada y «Orden de inversión» |
| `subtitulo` | h3 de `Section` | — |
| `pasos` | `Timeline` si cada paso trae sprite; si no, `<ol>` de la sección. Etiqueta generada «Paso {n}:» / «Step {n}:»; chips opcionales por paso | «Cómo aplicar» |
| `tabla` | `DataTable` con `caption` obligatorio; celdas de texto, cifra o elementos en línea; `wrap` si alguna celda tiene varias líneas | «Bandas», «Stones por elemento» |
| `nota` | `Note` («Observación:» / «Note:»), como mucho una por sección | «Bandas» |
| `tarjetas` | rejilla de `InfoCard` (2 columnas, 1 a 390), cada una título, sprite y texto | «Si falla» |
| `chips` | etiqueta en `ui-step` y una `<ol>` de chips | «Ejemplo con una piedra de 20%:» |
| `lista` | `<ul>` de la sección | «Orden de inversión» |

Elementos en línea: texto; enlace interno (ancla de la misma página o ruta del sitio); entidad (`tipo` + `id`) → `NestedEntity` según 8.0.5; importe de Pokédólares o de Diamonds (entero en unidades) → `PokedolaresAmount` o `DiamondsAmount` (R5). Un importe del juego escrito como texto libre no pasa `pnpm content:check`.

#### 8.4.1 Índice `/{l}/sistemas/`

**Plantilla:** D. **Render:** prerender.
1. Migas «Sistemas» / «Systems» (una miga).
2. `PageTitle` «Sistemas» / «Systems».
3. `IndexLinks`: una entrada por sistema en orden de registro, con su sprite y, si el registro trae filas, su tooltip (encima, anclado a la izquierda, `DS:IndexPanel`).
4. `Footer`.

**Estados:** sin sistemas publicados, `EmptyState` «Aún no hay sistemas publicados.» / «No systems published yet.». Sin carga.

#### 8.4.2 Página `/{l}/sistemas/{id}/`

**Plantilla:** C. **Render:** prerender, una por registro. Un `id` desconocido responde 404.
1. Migas «Sistemas › {titulo}».
2. `PageTitle` con `titulo` y `subtitulo` (`subtitleLang` si el subtítulo está en otro idioma que la página).
3. Bloques de `intro`.
4. `InfoBanner` si hay `banner`: sprite en la casilla de 64 × 32 y sus datos separados por «|».
5. Una `Section` por elemento de `secciones`, en orden, con `id` = el del registro.
6. Sección automática «Ítems» / «Items» (`id="items"`), la última, si `getSystemItems()` (`REPO:83-85`) tiene registros con `sistema` igual al `id`. Es la lista `sistema-items` de 8.0.6 con las tres vistas (R3, E16), `Count` «{n} ítems» / «{n} items» y `ViewToggle` («Vista de ítems» / «Item view»): Cards, `CardGrid family="loot"` de `LootCard` (títulos `h3`, clave «Uso» con `descripcion`); Slots, `SlotsPanel` de una lista con `EntitySlot size={40}` (44 táctil) como `<button>`; Lista, `DataTable` `caption` «Ítems de {titulo}» / «{title} items» con columnas Sprite · «Ítem» / «Item» · «Uso» / «Use». Cada ítem abre `systemItemTip` (§7.5.3) en Slots y Lista, y lleva `id="item-{id}"` (H7). La `descripcion` va con `lang="en"` en `es` mientras solo exista en inglés.
7. `Toc` con las secciones, en el mismo orden y con los mismos títulos.
8. `Footer`.

**A 390:** `InfoBanner` apila sus datos y oculta los «|»; `InfoCard` en 1 columna; tablas con `scroll`; subtítulo oculto por debajo de 460 (`DS:PageTitle`); sin `Toc`.

**Estados:** un registro sin secciones muestra título, entrada y banner. Error: una referencia a una entidad sin registro, un ancla sin sección o un importe en texto libre detienen `pnpm content:check`.

**Se quita:** Y-01 a Y-11 (§12.10) y las migas «Inicio / Sistemas» (B-04), que pasan a la miga única «Sistemas». El índice actual (`SIS`) deja de mostrar ítems y movimientos: los movimientos pasan a «Ataques» de la ficha (8.3) y los ítems de sistema a la página de su sistema (paso 6 de 8.4.2).

**Aceptación:** WG1; WG2 y WG3 contra `Sistema-Boost` a 1440 con `{"tip":null}` usando un fixture de `tests/` que reproduce el Boost del tablero con la forma del registro (los `InfoCard` en (248, 1650, 896 × 146), 2 columnas); WG4 para el índice. WG5; WA1–WA4; WL1; WD1. Además:
- SI1: el `Toc` tiene tantas entradas como secciones y en el mismo orden; al desplazarse, la entrada de la sección visible lleva `aria-current="location"`.
- SI2: cada mención de entidad del fixture es `NestedEntity` con tooltip; ninguna mención sin registro tiene `href`, `aria-describedby` ni `role="button"`.
- SI3: cada importe del juego del fixture lleva sprite y su nombre accesible es la cifra exacta (S8).
- SI4: con `OCULTAR_BORRADORES=1`, un sistema `borrador` no genera página ni aparece en el índice, el menú, el Inicio ni la búsqueda.
- SI5: con el registro actual, la página de `punching-bag-training` (si existe su registro de sistema) lista «Normal charger» en las tres vistas; su slot y su nombre en Lista abren `systemItemTip` con «Sistema:» y «Uso:»; la paleta encuentra «charger» en el grupo Ítems y lleva a `…/sistemas/punching-bag-training/#item-normal-training-charger` con el ítem enfocado (H7).

### 8.5 Ítems por categoría del Market

**Referencia:** sin tablero propio. Filtros, barra de resultados, rejilla y paginación de `Lienzo:Pokedex`; pestañas con sprite y grupos por tipo de `Lienzo:Comercio`; tarjeta, Slots y Lista de los drops de `Lienzo:Pokedex-Shiny-Charizard`. **Plantilla:** B. **Render:** prerender (una página por categoría) con la isla de lista `items` (8.0.6).

**Rutas:** `/{l}/items/` es «Todo» (la categoría virtual de `content/items/categorias.json`); `/{l}/items/c/{id}/` existe para cada una de las 13 categorías reales. Un `id` de categoría desconocido responde 404.

**Estructura**
1. Migas: «Ítems» / «Items» en `/items/` (una miga); «Ítems › {categoría}» en una categoría.
2. `PageTitle`: «Ítems» / «Items» en `/items/`; en una categoría, su `nombre` del registro en el idioma de la página.
3. Navegación de categorías: `<nav aria-label="Categorías del Market">` / «Market categories» con las 14 entradas en el orden del registro, cada una un enlace con el aspecto de `ToggleGroup variant="tab"` (sprite `ui/categorias/{id}` a 1x y etiqueta), que salta de línea. La actual lleva `aria-current="page"` y el fondo `bg-tertiary` del estado «Actual» (§5.2), sin el ámbar, que nunca marca un enlace (T9). Son enlaces, no botones (pestaña enlace, §7.2.8).
4. Barra de resultados: `Count` «{n} ítems» / «{n} items» (1: «1 ítem» / «1 item») y `ViewToggle`.
5. Resultados, 24 por página, en las tres vistas (8.0.6). En «Todo», la paginación se aplica primero y después se agrupa por categoría en el orden del Market (`CGS §2.1`); una categoría sin ítems en la página no aparece.
   - **Cards:** `LootCard` en `CardGrid family="loot"` (3 × 304 a 944). En «Todo», un `CardGroup` (h2) por categoría con sprite de 32, nombre en `body-strong` y conteo en `ui`, y títulos de tarjeta `h3`; en una categoría, títulos `h2` (7.6.2). Claves en este orden, por unión del resultado: «Drop de» (calculado de `drops` de Pokémon), «Elemento» (`elemento`), «Uso» (`uso`), «Precio NPC» (`precioNpc.vende`), «Precio de tienda» (`precioNpc.compra`) (Q12; en: «Dropped by», «Element», «Use», «NPC Price», «Shop price»). Con el registro actual, que solo trae precios nulos y ninguno de los campos nuevos, las tarjetas quedan con la cabeza. El título es texto (sin página de ítem, §15). `anchorId` = `item-{id}` (H7): lo llevan el `article`, el slot y la fila.
   - **Slots:** en «Todo», `SlotsPanel layout="side"` con una columna de etiqueta por categoría; en una categoría, una sola lista. `EntitySlot size={40}` (44 táctil) como `<button>` con el tooltip del ítem.
   - **Lista:** `DataTable` `caption` «Todos los ítems» / «All items» o «Ítems de {categoría}» / «{category} items», columnas Sprite · «Ítem» / «Item» · claves de la unión (en «Todo», también «Categoría» / «Category» tras el nombre); `ListRow variant="drops"` con el nombre como botón que abre el tooltip.
   - Tooltip del ítem (`itemTip`, §7.5.3; mismas filas en todas las categorías): sprite a 2x en la celda de 64, nombre y, con valor, «Categoría:», «Drop de:», «Elemento:», «Uso:», «Precio NPC:» (`precioNpc.vende`) y «Precio de tienda:» (`precioNpc.compra`) (en: «Category:», «Dropped by:», «Element:», «Use:», «NPC Price:», «Shop price:»); los dos precios como importe `{ pd }` con `PokedolaresAmount`.
   - Tooltip de la moneda Diamonds (`diamondsTip`, §7.5.3, lo usa sobre todo §9): filas «Se compran en:» y «Se usan en:» (en: «Bought at:», «Used for:») desde un objeto `moneda` nuevo de `content/items/diamantes.json` con dos listas por idioma, `seCompranEn` y `seUsanEn` (esquema en §3.13). Una lista vacía no genera fila; sin ninguna fila, la mención de Diamonds no es disparador (R2).
6. `Pagination align="center"` si hay más de una página.
7. `Footer`.

**A 390:** navegación de categorías en varias líneas con objetivos de 44; `LootCard` en 1 × 358 con separación 12; slots de 44; tabla con `scroll`.

**Datos:** `getCategorias` (`REG:90-92`) y `getItems` (`REG:95-101`, que ya aplica `OCULTAR_BORRADORES`); sprites por clave (`public/sprites/sprites.json`). Primera página en el HTML y el resto de `/{l}/items/datos.json` (PR5). Orden: el del archivo de la categoría. Los ítems `borrador` no llevan marca.

**Estados**
- Categoría sin ítems (o todos ocultos por `OCULTAR_BORRADORES`): `EmptyState` «No hay ítems en esta categoría.» / «There are no items in this category.», sin conteo ni vista.
- Sprite de relleno (`borrador` en `sprites.json`): se dibuja como cualquier sprite.
- Carga: ninguna.

**Se quita:** no hay página actual. Los 13 archivos de `content/items/` no tienen hoy ninguna ruta pública.

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1; WD1 para los conteos por categoría y en «Todo». Además:
- IT1: `/es/items/` lista los ítems de las 13 categorías agrupados en el orden del Market; `/es/items/c/stones/` lista solo `content/items/stones.json`.
- IT2: con `OCULTAR_BORRADORES=1` y el registro actual (todos los ítems son borrador), cada categoría muestra el `EmptyState` y el conteo del panel Ítems del Inicio no cambia (cuenta páginas, no ítems).
- IT3: un ítem con `precioNpc.vende` = 150000000 muestra en Cards la fila «Precio NPC» con el sprite de Pokédólares y «150kk», y su nombre accesible es «150.000.000 Pokédólares» (S8).
- IT4: ninguna tarjeta de ítem es disparador de tooltip; cada slot y cada nombre de la Lista lo es, con `aria-describedby`.
- IT5: un URL `…/items/c/{categoria}/?page={p}#item-{id}` del índice de búsqueda deja, tras aplicar el estado de la lista, el `article` (Cards), el slot (Slots) o la fila (Lista) de ese ítem dentro de la ventana, con su borde superior bajo la cabecera, y el foco en su título, su slot o su nombre (H7). Con una vista guardada distinta de Cards pasa lo mismo en esa vista.
- IT6: la pestaña de la categoría actual calcula fondo `bg-tertiary`, no tiene `box-shadow` de selección ni `aria-pressed`, y lleva `aria-current="page"`.

### 8.6 Buscar: paleta Ctrl + K y página de resultados

**Referencia:** sin tablero. `DS:SearchTrigger`, `RUB §2.2` y las familias de 8.2 y 8.5. Piezas, apertura, composición, teclado, puntuación y tooltip de la paleta: §7.9. Aquí se fijan qué entra en el índice, sus textos y la página de resultados.

**Índice** (`src/pages/[locale]/buscar/indice.json.ts`, §7.9.1). Un `SearchEntry` por entidad o página con destino, en los grupos de `SearchKind` y en su orden (el del menú):

| `kind` | Rótulo `es` / `en` | Entradas | `href` | `meta` |
|---|---|---|---|---|
| `pokemon` | «Pokémon» | cada registro de `content/pokemon.json` | su ficha | «Nivel {n} · {tier}», partes con valor |
| `sistema` | «Sistemas» / «Systems» | cada página de sistema (8.4) | su página | subtítulo, si lo tiene |
| `item` | «Ítems» / «Items» | cada ítem de `getItems()`; cada ítem de sistema de `getSystemItems()` cuya página de sistema existe (E16) | ítem: `/{l}/items/c/{categoria}/?page={p}#item-{id}`, con `p` la página de la categoría donde está (sin `page` si es la 1); ítem de sistema: `/{l}/sistemas/{sistema}/#item-{id}` | nombre de su categoría; en un ítem de sistema, el título de su sistema |
| `actividad` | «Actividades» / «Activities» | cada actividad publicada (8.9) | su página | «Nivel {n}» si lo tiene |
| `pagina` | «Páginas» / «Pages» | Pokédex, Tier list, Comparar Pokémon, Ítems, Sistemas, Actividades, Herramientas, Guild, Comercio y Cambios | la página | — |

Texto donde se busca, además del nombre (normalizado con `src/lib/search/normalize.ts`): en Pokémon, `id`, número escrito «6», «006», «#6» o «nº 6», etiquetas e `id` de sus elementos, «shiny» en las variantes Shiny y el tier («t3», «legendary»); en ítems, el nombre de su categoría; en sistemas, el subtítulo. `tip` = el constructor de §7.5.3 de su tipo. Ubicaciones y movimientos no tienen página en este corte y no entran (§15). Mapa no entra: es un marcador (8.11).

**Paleta: textos y una opción añadida**
- Placeholder «Buscar...» / «Search...» y rótulos de grupo de la tabla anterior.
- Sin resultados: «Sin resultados para «{q}».» / «No results for “{q}”.» (`EmptyState`, §7.9.3).
- Error al pedir el índice: «No se pudo cargar la búsqueda.» / «Couldn't load search.» (diccionario de §13). Volver a abrir la paleta repite la petición.
- Con consulta, la última opción del listbox, fuera de los grupos y sin rótulo, es «Ver todos los resultados de «{q}»» / «See all results for “{q}”» → `/{l}/buscar/?q={q}` (§7.9.3).

**Página `/{l}/buscar/`** (plantilla B, prerender con la isla de lista `buscar`; sin migas, 8.0.4)
1. `PageTitle` «Buscar» / «Search» (`id` del h1: `buscar-t`).
2. Región `role="search"` con `TextField variant="search"` (`aria-labelledby="buscar-t"`, hasta 100 caracteres). Filtra al escribir y escribe `q` en la URL (U5). Sin botón.
3. Sin `q`: `FeaturedSection` (Destacados); sin conteo ni lista.
4. Con `q`: `Count` «{n} resultados» / «{n} results» (1: «1 resultado» / «1 result») y `ViewToggle`; resultados con el orden de §7.9.4, 24 por página y agrupados después de paginar: un `CardGroup` (h2) por `kind` con resultados, en el orden de la tabla, con títulos de tarjeta `h3`. Pokémon: las tres vistas de 8.2. Ítems: las tres vistas de 8.5. Sistemas, Actividades y Páginas: `IndexLinks` (los sistemas con su tooltip), iguales en las tres vistas: el DS no tiene familia de tarjeta para ellos (E5).
5. `Pagination` si hay más de una página.
6. Sin coincidencias (V7): «Sin resultados para «{q}».» y debajo `FeaturedSection`.
7. Carga: la isla pide el mismo índice que la paleta; mientras llega, la zona de resultados está vacía. Error: la línea de error de la paleta en un `EmptyState`.

**Se quita:** B-01 a B-14 (§12.5), L-01 y L-02 (§12.18) y las migas «Inicio / Buscar en el Codex», que no tienen sustituto (E4). El índice de esta sección sustituye a `searchRecords` sobre las muestras (`REPO:101-108`, `:139-181`).

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1. Además:
- BU1: `/es/buscar/?q=charizard` muestra, tras hidratar, el grupo Pokémon con Charizard y Shiny Charizard y ningún resultado sin coincidencia; `/es/buscar/?q=zzzz` muestra «Sin resultados para «zzzz».»; `/es/buscar/` no muestra conteo ni resultados.
- BU2: «fuego», «fire», «006», «nº 6» y «legendary» encuentran en el índice `es` los Pokémon esperados del fixture.
- BU3: en la paleta, «char» + Intro navega a la primera opción del grupo Pokémon; la última opción lleva a `/{l}/buscar/?q=char`.
- BU4: con la petición del índice bloqueada, la paleta y la página muestran «No se pudo cargar la búsqueda.».
- BU5: el índice cumple el presupuesto de peso de §13.6 y no se descarga en una página hasta abrir la paleta o cargar `/{l}/buscar/`.
- BU6: ninguna entrada del índice apunta a una ruta que no existe (WG5 sobre los `href` del índice).

### 8.7 Cambios (`/{l}/cambios/`)

**Referencia:** sin tablero; plantilla C con `DS:Timeline`. **Render:** prerender. Sigue en el menú (grupo Comunidad) e indexable (A2).

**Registro** `content/cambios.json` (esquema en §3.13; se llena a mano, R10). Cada entrada: `id`, `fecha` (ISO `AAAA-MM-DD`), `titulo` por idioma, `puntos` por idioma (lista opcional), `entidades` (referencias opcionales `tipo` + `id`), clave de `sprite` opcional y `borrador`.

**Estructura**
1. Migas «Comunidad › Cambios» / «Community › Changes» («Comunidad» sin enlace, 8.0.4).
2. `PageTitle` «Cambios» / «Changes».
3. Una `Section` por mes con entradas, del más reciente al más antiguo. Título: mes y año con `Intl.DateTimeFormat` (`month: 'long', year: 'numeric'`) y la primera letra en mayúscula: «Septiembre de 2026» / «September 2026». `id` `AAAA-MM`.
4. Dentro, un `Timeline` con una entrada por paso, por `fecha` descendente y después por `id`: nodo = su `sprite` o, sin él, la clave fija `ui/cambios` (§3.13; el menú no tiene sprites fuera de «Destacados»); etiqueta = la fecha (formato de §13) con dos puntos («18/09/2026:»); texto = `titulo`; chips = `entidades` como `NestedEntity`; debajo, `puntos` como `<ul>` (puntos de un paso, §7.2.8).
5. `Toc` con los meses cuando hay dos o más.
6. `Footer`.

Ninguna entrada enlaza a un anuncio externo ni nombra de dónde sale (R6).

**Estados:** sin entradas, `EmptyState` «Aún no hay cambios publicados.» / «No changes published yet.» debajo del título, sin `Toc`. Sin carga. Una entidad sin registro detiene `pnpm content:check`.

**Se quita:** C-01 a C-06 (§12.6) y las migas «Inicio / Cambios» (B-04), que pasan a «Comunidad › Cambios».

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1; WD1. Además:
- CA1: con 3 entradas en dos meses hay 2 `h2` en orden descendente, 3 pasos y un `Toc` de 2 entradas; con 1 mes no hay `Toc` y la columna mide 944.
- CA2: con 0 entradas, el contenido de la columna principal (`main` sin `.ac-page-layout__foot`, el pie que `DS:PageLayout` pone dentro de `main`, `bundle.js:60-62`) contiene migas, h1 y exactamente un `<p>` con «Aún no hay cambios publicados.».
- CA3: `/es/cambios/` no lleva `noindex` y aparece en el menú.

### 8.8 Tier list (`/{l}/pokedex/tiers/`, antes Rotaciones)

**Referencia:** sin tablero propio; entrada «Tier list» de `Lienzo:Main` (grupo Pokémon y Destacados), barra y vistas de `Lienzo:Pokedex`, tabla «Tier list» de `Lienzo:Pokedex-Shiny-Charizard`. **Plantilla:** B (sin `Toc`: los grupos dependen de la página de la lista). **Render:** prerender con la isla de lista `tiers` (8.0.6). `/{l}/rotaciones/` redirige aquí (8.0.1, E1).

**Estructura**
1. Migas «Pokémon › Tier list».
2. `PageTitle` «Tier list».
3. `FilterBar layout="fill"`: «Generación», «Elemento» y el `ToggleGroup` «Variante» de 8.2 (sin «Tier»: los grupos son los tiers).
4. Barra de resultados: `Count` con los textos de 8.2 sobre los Pokémon con tier (los que tienen `tier` nulo no están en esta página) y `ViewToggle`.
5. Resultados, 48 por página, ordenados por tier (T1…T7 y después los especiales en el orden de `$defs.tierEspecial`; es el orden del esquema, no una jerarquía de fuerza) y dentro de cada tier por el orden de 8.0.5. Se pagina y después se agrupa por tier (§7.7.4): Cards, un `CardGroup level={2}` por tier presente en la página, con título = `formatTier` («T1», «Legendary») y conteo en la página, y su rejilla de `DexCard`; Slots, `SlotsPanel layout="stacked"` con un grupo por tier y `EntitySlot size={72}`; Lista, un solo `DataTable` con `caption` «Tier list» y las columnas de 8.2 (la columna «Tier» muestra el grupo).
6. `Pagination`.
7. Después de la lista, una `Section` por registro de `getRotations()` (`REPO:95-97`), si hay: título = `nombre`; `<p>` con `disponibilidad`; líneas «Condición:» con `condicion` y «No aparece en:» con `excluye` unida con «, » (en: «Condition:», «Not found in:»), cada una solo con valor. `tipo` y `comparacion` no se muestran. Hoy sus textos están solo en inglés: `lang="en"` en `es` (8.0.5).
8. `Footer`.

**A 390:** como 8.2.

**Estados:** vacío por filtros como en 8.2 (V7). Carga como en 8.2 (PR1).

**Se quita:** T-01 a T-05 (§12.11), S-24 (§12.2) y las migas «Inicio / Rotaciones y tiers» (B-04), que pasan a «Pokémon › Tier list». El h1 pasa a «Tier list» y cada registro de rotación cambia su panel `wiki-panel wiki-article-panel` (`ROT:57`) por una `Section`. «Condición» / «Condition» y «No aparece en» / «Not found in» se conservan como etiquetas con dos puntos.

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1; WD1. Además:
- TL1: con el registro actual, `/es/pokedex/tiers/` suma 818 variantes en el conteo, la página 1 contiene solo el grupo «T1» (88 variantes con tier 1, más que las 48 de la página) y ningún Pokémon con `tier` nulo aparece.
- TL2: `/es/rotaciones/` responde 302 a `/es/pokedex/tiers/`.
- TL3: la sección del registro de rotaciones va después de la lista, con `lang="en"` en `es`, y no contiene «availability_scope» ni «Conjunto comparado».
- TL4: las tres vistas de una misma página muestran las mismas 48 variantes, y dentro de cada tier en el mismo orden (S4).

### 8.9 Actividades (`/{l}/actividades/`, antes Guías)

**Referencia:** sin tablero; grupo y panel «Actividades» de `Lienzo:Main`; plantillas D y C; ejemplos de banner y `Timeline` de misión en `DS:InfoBanner` y `DS:Timeline`. `/{l}/guias/` redirige aquí (8.0.1, E2).

**Datos:** `getQuests()` (`REPO:87-89`, `content/quests.json`). Mientras §3.13 no pase sus textos a `es`/`en`, `resumen`, `instrucciones`, `requisitos`, `pasos`, `recompensas` y `notas` se tratan como inglés (`lang="en"` en `es`). Una actividad necesita clave de `sprite` (campo nuevo, opcional). `lugares`, `pokemon` y `sistemas` no se muestran: son cadenas sin entidad (R2).

#### 8.9.1 Índice

**Plantilla:** D. **Render:** prerender. Migas «Actividades» / «Activities»; `PageTitle` igual; `IndexLinks` con una entrada por actividad (sprite, `nombre`, sin tooltip) → `/{l}/actividades/{id}/`; `Footer`. Sin actividades: `EmptyState` «Aún no hay actividades publicadas.» / «No activities published yet.»

#### 8.9.2 Página `/{l}/actividades/{id}/`

**Plantilla:** C. **Render:** prerender, una por registro; `id` desconocido → 404.
1. Migas «Actividades › {nombre}».
2. `PageTitle` `{nombre}`.
3. Entrada: `resumen` y después `instrucciones`, un `<p>` cada uno, solo con valor.
4. `InfoBanner` si hay al menos un dato: «Requisito: Nivel {nivelRequerido}» (en `en`, «Requirement: Level {n}», §13.3) y «NPC: {npcs}» (unidos con «, »). Casilla de sprite con el sprite de la actividad o, sin él, la marca de sprite faltante.
5. Secciones, cada una solo si su lista no está vacía: «Requisitos» / «Requirements» (`<ul>`), «Pasos» / «Steps» (`<ol>`, o `Timeline` cuando cada paso tenga sprite), «Recompensas» / «Rewards» (`<ul>`; una recompensa que sea referencia a un ítem con registro es `NestedEntity`), «Observaciones» / «Notes» (`<ul>` con `notas`).
6. `Toc`, `Footer`.

**Estados:** sin carga; error de registro detiene el build.

**Se quita:** Q-01 a Q-13 (§12.9) y las migas «Inicio / Guías» (B-04), que pasan a la miga única «Actividades». El h1 pasa a «Actividades» / «Activities»; «Misiones» (A7) y la sección «Ubicaciones y viaje» salen, porque `content/locations.json` no tiene página en este corte (R9, §15).

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1; WD1. Además:
- AV1: con el registro actual existe `/es/actividades/porygon-quest-dr-vektor/` con el banner «Requisito: Nivel 200 | NPC: Dr. Vektor» y las secciones Requisitos, Pasos (6 elementos de `<ol>`), Recompensas y Observaciones, con `lang="en"` en su texto en `es`.
- AV2: `/es/guias/` responde 302 a `/es/actividades/`.
- AV3: el `<ol>` de Pasos no contiene números escritos a mano.

### 8.10 Herramientas (`/{l}/herramientas/`)

**Plantilla:** D. **Render:** prerender. Índice del grupo Herramientas del menú.
1. Migas «Herramientas» / «Tools».
2. `PageTitle` «Herramientas» / «Tools».
3. `IndexLinks`: «Guild» → `/{l}/herramientas/guild/` y «Mapa» / «Map» → `/{l}/mapa/`, con las claves fijas `ui/herramientas/guild` y `ui/herramientas/mapa` (§3.13; sin sprite, la celda de 32 queda vacía). Sin descripciones, estados ni hoja de ruta. «Comparar Pokémon» está en el grupo Pokémon (8.0.3, §11).
4. `Footer`.

**Estados:** ninguno variable.

**Se quita:** TI-01 a TI-10 (§12.12) y las migas «Inicio / Herramientas» (B-04), que pasan a la miga única «Herramientas».

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1. Además: HT1: el `main` tiene exactamente 2 enlaces de índice y ninguna palabra de estado («Disponible», «Próximamente», «Preview»).

### 8.11 Mapa (`/{l}/mapa/`, marcador, R9)

**Plantilla:** E. **Render:** prerender. Lleva `noindex` mientras sea un marcador (§13).
1. Migas «Herramientas › Mapa» / «Tools › Map».
2. `PageTitle` «Mapa» / «Map».
3. `EmptyState` «El mapa aún no está disponible.» / «The map isn't available yet.»
4. `Footer`.

`MapExplorer`, `content/map/*` y `src/lib/map/*` se conservan sin usar para el corte del mapa (R9, §15). `/{l}/mapa/aportar/` redirige aquí (A1).

**Se quita:** las cadenas de §12.15, las migas «Inicio / Herramientas / Mapa» (B-04), que pasan a «Herramientas › Mapa», la sección con `MapExplorer` (R9) y el archivo `AP` completo (R-03, A1). La descripción de `MI:18/:26` se reescribe según §13.5, sin prometer un mapa interactivo.

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1. Además:
- MP1: el contenido de la columna principal (`main` sin `.ac-page-layout__foot`, como en CA2) contiene migas, h1 y exactamente un `<p>`; 0 `canvas`, 0 `img` y 0 botones.
- MP2: `/es/mapa/aportar` y `/es/mapa/aportar/` responden 302 a `/es/mapa/`; `dist/` no contiene HTML de `mapa/aportar`.
- MP3: el HTML lleva `<meta name="robots" content="noindex">` (§13).

### 8.12 404

**Archivo:** `src/pages/404.astro` (nuevo), SSR, estado HTTP 404. **Plantilla:** E. Idioma por el prefijo de la ruta pedida: `/en` o `/en/…` → `en`; cualquier otro → `es`. `noindex` (§13). Sin migas (8.0.4). Con un 404 bajo demanda, `@astrojs/vercel` añade al final de `.vercel/output/config.json` la ruta `{ "src": "/.*", "dest": "_render", "status": 404 }` (`node_modules/@astrojs/vercel/dist/index.js:340-366`; hoy ya existe, apuntando al 404 por defecto de Astro). Las pruebas la sirven con el emulador de §14.3, que ejecuta esa función.
1. `PageTitle` «Página no encontrada» / «Page not found».
2. `<p>` «No existe ninguna página en {ruta}.» / «There is no page at {path}.», con la ruta pedida como texto escapado (nunca HTML), recortada a 120 caracteres con «…».
3. `SearchTrigger` (`home` desde 768, `mobile` por debajo), que abre la paleta.
4. `FeaturedSection` con Destacados.
5. `Footer`.

**Se quita:** la página por defecto de Astro («404: Not found», logo de Astro, sin marco ni idioma; R-02, §12.3).

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1. Además:
- NF1: `/es/no-existe/` y `/en/does-not-exist/` responden 404 con el marco, el h1 del idioma y el menú; `/xx/` y `/xx/pokedex/` responden 404 en `es`.
- NF2: `/es/<script>alert(1)</script>/` muestra la ruta como texto y no ejecuta nada.
- NF3: los enlaces a fichas y páginas de sistema o actividad con `id` desconocido llegan a esta página con estado 404, no a una redirección.

### 8.13 Raíz y raíz de locale

- `/` responde 302 con `Location: /es/`, declarado en configuración (T16). Se borra `ROOT` (`ROOT:2` prerender y `ROOT:4` `Astro.redirect`, que hoy genera una página con meta refresh). `dist/` no contiene HTML para `/`.
- `/es` y `/en` sin barra final sirven el Inicio de su idioma con como mucho una redirección, según la política de barra final de §3.13. La URL canónica es la de la barra final (§13).
- `/{l}/` es el Inicio (8.1).

**Aceptación:** RZ1: `GET /` → 302 a `/es/` sin cuerpo HTML con `http-equiv="refresh"`. RZ2: `GET /en` termina en 200 con el Inicio en inglés tras como mucho una redirección. RZ3: ninguna ruta de 8.0.1 responde con más de una redirección encadenada. Las tres corren sobre el emulador de §14.3, que lee las redirecciones de `.vercel/output/config.json`: prueban la configuración que se despliega, no una copia.

### 8.14 Comparar Pokémon hasta F5 (`/{l}/herramientas/pokemon/`, marcador, E18)

**Plantilla:** E. **Render:** prerender. `noindex` mientras sea marcador (§13.5). Se construye en F2, en el mismo cambio que publica la Tier list (§8.8).
1. Migas «Pokémon › Comparar Pokémon» / «Pokémon › Compare Pokémon» («Pokémon» sin enlace, 8.0.4).
2. `PageTitle` «Comparar Pokémon» / «Compare Pokémon».
3. `EmptyState` «La comparación de Pokémon aún no está disponible.» / «Pokémon comparison isn't available yet.»
4. `Footer`.

La entrada del menú (grupo Pokémon, 8.0.3) se conserva: su ruta existe. Se borran `PokemonExplorer.tsx` con sus dos pestañas y el encabezado de `TPK` (§12.13); «Explorar tiers» vive en la Tier list (R15, E1). F5 sustituye este marcador por la herramienta de §11 en la misma ruta.

**Se quita:** las filas de §12.13.

**Aceptación:** WG1; WG4; WG5; WA1–WA4; WL1. Además: CP1: el contenido de la columna principal (sin `.ac-page-layout__foot`) contiene migas, h1 y exactamente un `<p>`, sin botones ni isla; `/es/herramientas/pokemon/` lleva `noindex` y no aparece en el sitemap; `src/components/tools/PokemonExplorer.tsx` no existe.

---

## 9. Comercio

Fuentes: `Lienzo:Comercio`, R13 (D-009, D-007), `docs/TRADE_PRODUCT_PLAN.md`, `DS:guias/40`, `DS:guias/30`, `CGS §6.1`, `CGS §10`, `CGS §11`. Las citas `archivo:línea` se comprobaron en el árbol de trabajo del 2026-09-19.

### 9.1 Punto de partida y alcance

Hoy `/{locale}/comercio/` es una página prerenderizada (`src/pages/[locale]/comercio/index.astro:11`) con un compositor de sesión, `TradeDesk` (`src/components/trade/TradeDesk.tsx`, 801 líneas):
- intención Vender/Comprar (`TradeDesk.tsx:394-403`) y cuatro activos (`:190`);
- campos de Pokémon en texto libre (`:33-44`, `:472-645`) y ocho habilidades de entrenamiento (`:47-56`);
- precio en BRL, USD, MXN, KK o DIAMONDS (`:198`), y «A convenir»;
- vista previa y copia al portapapeles (`:350-365`).

No lista anuncios, no guarda y no publica. `src/lib/trade/draft.ts` valida enteros positivos de hasta 15 cifras (`:7-16`), porcentajes (`:38-42`) y precios (`:44-49`).

v2 construye el mercado de `Lienzo:Comercio`:
- lista de anuncios con tres vistas;
- detalle del anuncio;
- publicar anuncio;
- perfil del vendedor;
- cuenta verificada;
- operaciones con reseña;
- reportes y moderación.

Regla de producto: R13. No hay pasarela de pago, custodia de fondos ni conversión entre monedas.

Se conservan de `draft.ts`, con sus pruebas (`tests/trade/draft.test.ts`):
- `parsePositiveWhole(texto, locale)`, adaptada al idioma: hoy solo acepta la coma como separador de miles (`draft.ts:9-16`), así que rechaza «1.500» en `es`. Pasa a aceptar dígitos sin agrupar o agrupados con el separador de miles del idioma (punto en `es`, coma en `en`), con el mismo límite de 15 cifras;
- `isDittoSlug`, `isValidOptionalPercent`;
- `isValidPrice`, adaptada a las monedas de §9.4;
- `compactKks`, solo para el texto copiado (§9.7.7, E12).

`formatWhole` y `formatPokedolares` ceden a `src/lib/format/` (§4.3, `DS:guias/40`).

Se borran `TradeDesk.tsx` y `src/styles/trade.css` (S18), y se reescribe el cuerpo de `comercio/index.astro`.

Sale de la interfaz la intención «Comprar»: el tablero solo tiene anuncios de venta y el banner describe al comprador que contacta al vendedor. Los anuncios de compra quedan en §15.

### 9.2 Fases

| Pieza | Fase A: estática, sin Supabase | Fase B: Supabase |
|---|---|---|
| Lista: búsqueda, tipo, filtros, orden, tres vistas | Sí, sobre `tests/fixtures/comercio/anuncios.json` con `COMERCIO_DEMO=1`; sin él, vacía | Sí, sobre `trade_listings` |
| Detalle del anuncio | Prerenderizado desde el registro, solo con `COMERCIO_DEMO=1` | SSR (§9.3) |
| Perfil del vendedor | Prerenderizado desde `tests/fixtures/comercio/vendedores.json`, solo con `COMERCIO_DEMO=1` | SSR |
| Crear anuncio | Formulario completo; la acción es «Copiar anuncio» | La acción es «Publicar» |
| Contactar, operaciones, reseñas | No existen: ni botón ni ruta | Sí |
| Reportes y moderación | No existen | Sí |
| Cuenta y verificación | `/cuenta/` existe solo para Guild (§10.4), si Supabase está configurado. Sin secciones de Comercio | Añade teléfono, perfil de Comercio y canales (§9.9) |

- **Interruptor de fase:** la fase B se activa con la variable `COMERCIO_PUBLICO` (`1` o `true`), leída en build y en servidor igual que `hideDrafts` (`src/lib/content/registry.ts:35-51`). Sin ella, ninguna ruta, botón ni texto de la fase B existe en el HTML (S11). Cómo cambia el modo de render de cada ruta: §9.3.
- **Interruptor de demostración:** los anuncios y vendedores de la fase A los escribe el equipo para probar cada rama (§9.4), así que son datos de demostración, no ofertas. `src/lib/trade/registry.ts` solo lee `tests/fixtures/comercio/*` con `COMERCIO_DEMO=1` (o `true`), leída como las anteriores; sin ella devuelve listas vacías. `COMERCIO_DEMO=1` va en el servidor de desarrollo de las pruebas (§14.3) y en el build visual (`VISUAL=1` la implica y lee el fixture de §14.5); nunca en el build de producción (lo comprueba `seo:check`, §13.5). `OCULTAR_BORRADORES` no afecta a Comercio: así un build de producción conserva los registros `borrador` de la wiki (los 30 ítems del registro actual lo son) sin publicar ofertas inventadas. `pnpm content:check` valida `tests/fixtures/comercio/*` siempre.
- **En producción, fase A:** muestra el estado vacío de §9.5.10 y «Crear anuncio», y no genera páginas de detalle ni de perfil. Nunca muestra ofertas ni reseñas ficticias (D-007, R12).
- **Gate de lanzamiento público de la fase B** (D-007, D-009, R13):
  1. términos de PokeAlliance revalidados;
  2. pruebas RLS de §9.12.2 en verde;
  3. moderación operativa (§9.11), con al menos un moderador;
  4. decisiones D-B1–D-B7 de §9.13 tomadas;
  5. aceptación del propietario con cuentas de prueba.

  Las migraciones se escriben y prueban solo en local.

### 9.3 Rutas

| Ruta | Contenido | Render | Indexable | Fase |
|---|---|---|---|---|
| `/{locale}/comercio/` | Lista (§9.5) | A: prerender. B: SSR de la primera página, filtros en la isla | Sí | A, B |
| `/{locale}/comercio/anuncio/[id]/` | Detalle (§9.6), plantilla F | A: prerender con `getStaticPaths` sobre el registro (vacío sin `COMERCIO_DEMO`). B: SSR | No (`noindex`) | A, B |
| `/{locale}/comercio/vendedor/[handle]/` | Perfil (§9.8), plantilla H | Como el detalle | No | A, B |
| `/{locale}/comercio/publicar/` | Crear / publicar / editar (§9.7), plantilla G | Prerender del marco e isla | No | A, B |
| `/{locale}/comercio/operaciones/` | Retirada (dueño, 2026-09-25): 302 a `/{locale}/cuenta/operaciones/` en todos los builds | Redirección de `astro.config.mjs` | No | — |
| `/{locale}/comercio/moderacion/` | Cola de moderación (§9.11), plantilla H | SSR; 404 si la cuenta no es moderadora | No | B |
| `/{locale}/cuenta/` | Acceso y guilds (§10.4). En B, además verificación de teléfono, perfil de Comercio y canales (§9.9). Plantilla H | Prerender del marco e isla con sesión. Existe si `getSupabasePublicConfig()` (`src/lib/supabase/env.ts`) no es `null` | No | Guild; B para Comercio |
| `/{locale}/cuenta/perfil/`, `/{locale}/cuenta/anuncios/`, `/{locale}/cuenta/operaciones/` | «Mi perfil» (reputación y reseñas), «Mis anuncios» y «Mis operaciones» (§9.16.3, §9.10), en el marco de `/{locale}/cuenta/` | Prerender del marco e isla con sesión. Existen con la configuración pública de Supabase y `COMERCIO_PUBLICO` | No | B |

Migas: «Comunidad › Comercio», seguidas del título del anuncio o del nombre del vendedor. «Cuenta» no lleva padre.

**Modo de render por fase** (`src/integrations/comercio-fases.ts`, registrada en `astro.config.mjs`, §3.13):
- Las rutas de la lista, el detalle y el perfil no exportan `prerender`. En `astro:route:setup`, la integración pone `route.prerender = !comercioPublico()` a cada ruta cuyo `component` empieza por `src/pages/[locale]/comercio/` y no es `publicar/`. Astro aplica el hook después de leer la exportación (`node_modules/astro/dist/core/routing/prerender.js`) y el hook ganaría en silencio, así que la integración lee el archivo y hace fallar el build si alguna de esas páginas exporta `prerender`.
- `operaciones` y `moderacion` no viven en `src/pages/`: están en `src/routes/comercio/` y la integración las añade con `injectRoute` en `astro:config:setup` solo con `COMERCIO_PUBLICO` (`moderacion` con `prerender: false`). Sin la variable no existen: responden 404.
- El JSON de datos de la lista de la fase A (PR5) también vive en `src/routes/comercio/datos.json.ts` y se inyecta como `/[locale]/comercio/datos.json` solo con `COMERCIO_DEMO` y sin `COMERCIO_PUBLICO`.
- Con la fase B, el detalle y el perfil ignoran `getStaticPaths` y leen Supabase; `getStaticPaths` sigue exportado para la fase A.
- CA-9.18 prueba los dos builds.

### 9.4 Modelo del anuncio

Tipos en `src/lib/trade/types.ts`. En la fase A los usa el registro; en la fase B, las filas de §9.12.1.

```ts
type TipoActivo = 'pokemon' | 'items' | 'diamonds' | 'pokedolares'; // orden fijo de grupos (R4)
type MonedaReal = 'BRL' | 'USD' | 'MXN';            // se muestran «R$», «US$», «MX$»
type OpcionJuego = { tipo: 'pokedolares' | 'diamonds'; cantidad: number }; // entero ≥ 1, unidades base
type EstadoAnuncio = 'publicado' | 'reservado' | 'completado' | 'expirado' | 'retirado';

type Precio = {
  real: { moneda: MonedaReal; importe: string } | null; // decimal con punto y ≤ 2 decimales: "90", "35.50"
  juego: OpcionJuego[];                                  // 0 a 2 opciones, de tipos distintos
  aConvenir: boolean;                                    // true ⇒ real = null y juego = []
};

type UnidadPokemon = {
  pokemon: string;                                  // id de content/pokemon.json
  ball: { item: string | null; nombre: string } | null;
  aura: string | null;                              // id de content/auras.json
  boost: number | null;                             // 0–50
  starLevel: number | null;                         // 0–5
  nickname: string | null;                          // ≤ 40
  memorySlots: number | null;                       // 1–6, solo Ditto y Shiny Ditto
  memorias: (string | null)[];                      // largo = memorySlots; ids del roster
  helds: { item: string | null; nombre: string; tier: number }[]; // ≤ HELDS_MAX
  addon: { id: string | null; nombre: string } | null;
  nextBoostChance: string | null;                   // "0"–"100", ≤ 2 decimales
  entrenamiento: { habilidad: Habilidad; nivel: number | null; progreso: string | null }[];
  precioNpc: { tipo: 'unsellable' } | { tipo: 'pokedolares'; cantidad: number } | null;
};

type Anuncio = {
  id: string;
  tipo: TipoActivo;
  vendedor: string;             // handle
  mundo: string;                // id del registro de mundos (§8, X3)
  publicado: string;            // instante ISO 8601 con zona
  expira: string;               // instante ISO 8601
  estado: EstadoAnuncio;
  precio: Precio;
  pokemon?: UnidadPokemon;
  item?: { item: string | null; nombre: string; cantidad: number };
  cantidad?: number;            // diamonds y pokedolares
  borrador?: true;              // solo en el registro de la fase A
};
```

- `Habilidad` son las ocho habilidades de `TradeDesk.tsx:47-56`, en ese orden: Attack, Critical Damage, Critical Chance, Critical Resistance, Defense, HP, Precision, Evasion. Se escriben en inglés en ambos idiomas (T23).
- `HELDS_MAX = 2`, los dos campos Held X y Held Y de hoy (`TradeDesk.tsx:38-39`).
- El tier de un held es un entero de 1 a `HELD_TIER_MAX = 99`. Es un límite del campo, no un dato del juego (Q8).
- Las cantidades de Pokédólares se guardan como enteros en unidades base (R5): 50kk es `50000000`. El límite es 999.999.999.999.999 (15 cifras, `draft.ts:7`), por debajo de `Number.MAX_SAFE_INTEGER`.
- Los datos del catálogo (Requisito, Tier, Elementos, Categoría) no se guardan en el anuncio: se leen del registro al mostrarlo.
- Un nombre declarado que coincide exactamente, sin mayúsculas ni acentos, con un registro (ball, held, item, addon) guarda su `id`. Así lo hace hoy el item en `TradeDesk.tsx:258-265`. Si no coincide, `id` es `null` y el nombre se muestra como texto, sin tooltip ni sprite (R2).

**Título del anuncio.** `listingTitle(anuncio, locale): { texto: string; accesible: string }` en `src/lib/trade/title.ts`, con prueba unitaria por tipo. `texto` es lo visible; `accesible`, lo que oye el lector de pantalla (R5). Son iguales salvo en Pokédólares.

| Tipo | `texto` (es / en) | `accesible` |
|---|---|---|
| `pokemon` | `nombre` del registro de Pokémon («Shiny Ditto»), sin nickname | igual |
| `items` | nombre del ítem del registro o el declarado («Fire Stone»); la cantidad es un hecho, no parte del título | igual |
| `diamonds` | «{formatInteger(cantidad)} Diamonds» («300 Diamonds», «2.400 Diamonds» / «2,400 Diamonds») | igual |
| `pokedolares` | «{formatPokedolares(cantidad)} Pokédólares» / «… Pokédollars» («50kk Pokédólares») | «{formatInteger(cantidad)} Pokédólares» («50.000.000 Pokédólares») |

- Donde el título es texto de la página (título de tarjeta, h1 del detalle, última miga, «Operación: {título}» de una reseña), se pinta `texto` con `aria-hidden="true"` y `accesible` en `sr-only` cuando difieren, como `PokedolaresAmount` (7.8).
- Donde es un atributo o texto plano: `aria-label` del slot «{accesible}, {precio}» (§9.5.8); `<title>` y `og:title` del detalle con `accesible` (§13.5); título del tooltip con el nickname o, sin él, `texto` (§9.5.9); `searchText` con los dos (§9.5.2).

**Estados que ve el público.**
- Lista (§9.5) y anuncios del perfil (§9.8): solo `publicado` y `reservado` cuya `expira` es posterior al reloj del visitante. La isla aplica ese filtro con un reloj inyectable al hidratar y cada minuto; en la fase B la consulta además exige `status in ('publicado', 'reservado') and expires_at > now()`. El HTML prerenderizado de la fase A excluye los que ya habían expirado en el build.
- Detalle (§9.6): todo estado salvo `retirado`, que da 404 al público; `completado` y `expirado` (también por tiempo) muestran su línea de estado y ninguna acción de compra. Las reseñas (§9.8) enlazan a estos detalles.

**Registro de la fase A** (solo se lee con `COMERCIO_DEMO=1`, §9.2).
- `tests/fixtures/comercio/anuncios.json` (`{ "anuncios": Anuncio[] }`) y `tests/fixtures/comercio/vendedores.json`.
- `vendedores.json` tiene la forma `{ "vendedores": [{ id, nombre, desde, canales: [{ tipo, etiqueta }], resenas: [{ puntuacion, comentario, fecha, anuncio, comprador }], borrador }] }`.
- Esquemas en `content/schemas/comercio-anuncios.schema.json` y `comercio-vendedores.schema.json` (draft 2020-12, claves en español, R7).
- `pnpm content:check` (`scripts/content/check.mjs`) comprueba:
  - las referencias a vendedor, mundo, Pokémon, auras, items y addons;
  - los rangos de este apartado;
  - las reglas de precio de §9.7.4;
  - que todo registro lleve `"borrador": true`.
- La valoración nunca se guarda: se calcula de `resenas` (§9.10).
- Contenido mínimo, para que las pruebas cubran cada rama:
  - al menos un anuncio por tipo;
  - un Shiny Ditto con Memory Slots y memorias;
  - un Pokémon con 2 held items y entrenamiento;
  - un anuncio con dinero real y dos opciones en el juego;
  - uno «A convenir», uno `reservado` y uno `expirado`;
  - un vendedor sin reseñas.

  Los textos y cifras los escribe el equipo o el propietario. Ninguno se copia de un tablero (X4). Son datos de demostración: nunca llegan al build de producción (§9.2, PZ-08).

### 9.5 Lista de anuncios

#### 9.5.1 Composición

Como `Lienzo:Comercio` a 1440: columna de 944 sin rail (`CGS §3`). De arriba abajo:

1. `Breadcrumb` «Comunidad › Comercio».
2. `PageTitle` «Comercio».
3. `InfoBanner`:
   - sprite: `ui/diamond` a 1x, animado;
   - datos: «Alliance Codex no procesa pagos | El comprador contacta al vendedor por sus canales verificados | Reseñas de 0 a 5, solo de operaciones confirmadas por ambas partes». En `en`: «Alliance Codex doesn't process payments | Buyers contact sellers through their verified channels | Reviews from 0 to 5, only for deals both sides confirmed».
   - Se muestra si la fase B está activa o si el conjunto de anuncios no está vacío. En la fase A en producción la página no tiene verificación ni reseñas, así que el banner no aparece (R12).
4. Bloque de controles, con 16 entre filas:
   - Fila de búsqueda:
     - `TextField variant="search"` con etiqueta oculta «Buscar anuncios» y placeholder «Shiny Ditto +20, Premier, Memory Slots 6, Fire Stone, 50kk…» (`DS:guias/40`);
     - a la derecha, `Button` «Publicar anuncio» (fase B) o «Crear anuncio» (fase A), hacia `/comercio/publicar/`.
   - `ToggleGroup variant="tab"` con etiqueta visible «Tipo de activo». Opciones y sprites del registro:
     - «Todos», sin sprite;
     - «Pokémon»: `outfits/5`;
     - «Items»: `items/stones/fire-stone`;
     - «Diamonds»: `ui/diamond`, animado;
     - «Pokédólares»: `ui/pokedolares`.
   - `FilterBar` de 4 columnas: «Mundo», «Moneda», «Precio» y «Valoración del vendedor» (§9.5.4).
   - Barra de resultados:
     - a la izquierda, `Count` («1 anuncio» / «N anuncios»; en `en`, «listing» / «listings»), con `aria-live="polite"`;
     - a la derecha, con 24 de separación, `SortSelect` y `ViewToggle`.
5. Resultados en la vista elegida (§9.5.8).
6. `Pagination`, solo si hay más de una página.

#### 9.5.2 Búsqueda

- `searchText(anuncio, locale)` concatena y normaliza (NFD sin diacríticos, minúsculas):
  - título; nombre del Pokémon; nickname, tal cual y sin espacios («S U S A N O O» también da «susanoo»);
  - ball y aura;
  - cada held como «x-attack t5»; addon; nombres de las memorias;
  - «boost +N», «star level N», «memory slots N»;
  - nombre del item y «×N»;
  - cantidades en cifra exacta y en forma corta exacta («50000000 50kk»);
  - precios («90», «150kk», «400 diamonds»);
  - nombre del mundo y nombre del vendedor.
- La consulta se parte por espacios y comas. Un anuncio coincide si cada fragmento es subcadena de su `searchText`.
- Filtra y escribe la URL según U5 (§7.7.2). Una consulta vacía no filtra.

#### 9.5.3 Tipo de activo

Valores `todos | pokemon | items | diamonds | pokedolares`. Cambiar de tipo vuelve a la página 1 y cierra el tooltip abierto.

#### 9.5.4 Filtros

Actúan al cambiar, sin botón «Aplicar» (`DS:FilterBar`).

- **Mundo** (`Select`): «Todos» y los mundos de `content/mundos.json` (§8.1), en su orden. Compara con `anuncio.mundo`.
- **Moneda** (`Select`): «Todas», «R$», «US$», «MX$», «Pokédólares», «Diamonds». Un anuncio coincide si tiene un precio en esa moneda, en `real` o en una opción de `juego`. Un anuncio «A convenir» solo coincide con «Todas».
- **Precio** (`RangeField`, «Mín» y «Máx»):
  - Se aplica al importe del anuncio en la moneda elegida, sin conversión.
  - Con «Todas», los dos campos quedan `disabled` y la leyenda dice «Precio (elige moneda)».
  - Pokédólares acepta «50kk», «2,5k» o la cifra agrupada, con `parsePokedolares` (§4.3). Diamonds acepta enteros. El dinero real acepta hasta 2 decimales (`isValidPrice`).
  - Un extremo no válido lleva `aria-invalid="true"`, no filtra y tiene descripción oculta «Importe no válido».
- **Valoración del vendedor** (`Select`): «Todas», «4.5 o más», «4.0 o más», «3.0 o más» (punto decimal, X5). Con un umbral elegido se excluyen los vendedores sin reseñas.

#### 9.5.5 Orden

`SortSelect`:
- **«Recientes»** (por defecto): `publicado` descendente.
- **«Mejor valorados»:**
  1. valoración descendente;
  2. número de reseñas descendente;
  3. `publicado` descendente;
  4. los vendedores sin reseñas, al final.
- **«Precio, menor primero»:**
  - La clave de precio es el dinero real si existe; si no, la primera opción en el juego.
  - Los grupos van en el orden R$, US$, MX$, Pokédólares, Diamonds, sin conversión entre ellos.
  - Dentro de cada grupo, importe ascendente.
  - «A convenir» va al final.
  - Los empates se resuelven por `publicado` descendente.
- Los anuncios promocionados no existen (§15). Cuando existan, llevarán etiqueta y no alterarán el orden por valoración (D-009).

En Slots y en Cards con «Todos», el orden se aplica dentro de cada grupo de tipo.

#### 9.5.6 Conteo y paginación

- El conteo es el total tras búsqueda, tipo y filtros; no el de la página.
- 24 anuncios por página (divisible por 1, 2, 3 y 4 columnas).
- La paginación se aplica antes de agrupar (R4).
- Cambiar búsqueda, tipo, filtro u orden vuelve a la página 1.
- En las dos fases, `Pagination` pinta enlaces reales con `?page=N` y el controlador de listas intercepta el clic (H6, §7.7.3).

#### 9.5.7 Estado en la URL

- Controlador de §7.7 con `ListConfig` `id: 'comercio'`: `q`, los filtros `tipo`, `mundo`, `moneda`, `min`, `max` y `val`, y `sort`, `view` y `page`, solo cuando difieren del valor por defecto (U1–U4). Los valores son identificadores, nunca etiquetas (U3).
- Atrás y Adelante recorren las páginas visitadas (H1, H2); cambiar búsqueda, tipo, filtro u orden reescribe la URL sin añadir entradas.
- La vista sigue U6: la de la URL o, si no viene, la guardada en `localStorage['ac:vista:comercio']`. El perfil del vendedor usa `id: 'comercio-vendedor'` (§9.8).

#### 9.5.8 Vistas

**Cards**
- `CardGrid family="listing"` (mínimo 280, de 1 a 4 columnas) con `ListingCard`. Cada rejilla usa `layout = listingLayout(anuncios de esa rejilla en la página)`.
- Con «Todos», una `CardGroup` por tipo en el orden Pokémon, Items, Diamonds, Pokédólares, con 32 entre grupos:
  - la cabeza lleva el sprite de 32 de la pestaña, el nombre y el conteo de ese tipo en la página;
  - un tipo sin anuncios en la página no aparece.
- Títulos de tarjeta: `h3` bajo los grupos h2 de «Todos»; `h2` con un solo tipo (sin grupos, 7.6.2).
- La tarjeta no abre tooltip (R3):
  - el título, `listingTitle` (§9.4), enlaza al detalle;
  - sí abren el suyo Ball, Elementos, cada held, los Diamonds de un precio y el «+N» de canales.
- La meta de la cabeza es «{Mundo} · {publicado relativo}», y «· Reservado» si aplica. Los Pokémon con `variante: "shiny"` llevan la línea Shiny.
- Hechos por tipo, en el orden canónico de `DS:ListingCard`; cada clave aparece si al menos un anuncio de la rejilla tiene valor (`CGS §5.3`):

| Tipo | Clave | Fuente |
|---|---|---|
| Pokémon | Requisito | `nivel` del roster → «Nivel N» (Q5) |
| | Tier | `tier` del roster con `formatTier` (§8.0.5, §13.3) |
| | Elementos | `elementos` del roster → `ElementChip` |
| | Ball | Declarado; `NestedEntity` si tiene `item` |
| | Aura | Declarado; nombre del registro de auras |
| | Boost | Declarado, «+N» |
| | Nickname | Declarado, sin recortar espacios (modo `pre`) |
| | Memory Slots | Declarado, solo Ditto y Shiny Ditto |
| | Star Level | Declarado |
| | NPC Price | Declarado: «Unsellable» o importe con sprite de Pokédólares |
| Items | Cantidad | Declarada |
| | Categoría | `categoria` del item → nombre en `content/items/categorias.json` |
| | Elemento, Uso, Drop de | Solo si el registro de items los tiene. `content/schemas/items.schema.json` no tiene esos campos, así que hoy no aparecen |
| Diamonds | Cantidad | Declarada, sprite y número sin enlace (`DS:guias/40`) |
| | Se compran en, Se usan en | Objeto `moneda` de `content/items/diamantes.json` (§8.5); una lista vacía no genera fila |
| Pokédólares | Cantidad | Declarada (`PokedolaresAmount`). Título: `listingTitle` (§9.4) |

- Zonas de Pokémon:
  - «Held Items: N» con `HeldStrip`;
  - «Entrenamiento», que en la tarjeta muestra la primera habilidad declarada en el orden de `Habilidad` como «Attack 16 (53%)», con `TrainingMeter`, o «—».
- Pie:
  - «Dinero real»;
  - «En el juego» (`PriceOptions`);
  - «Vendedor» (`Rating`);
  - «Contacto verificado» (`ChipRow` con tope 3 y «+N»).
- Un anuncio «A convenir» muestra «A convenir» en la primera fila de precio de la rejilla y «—» en la otra.

**Slots**
- `SlotsPanel layout="side"`: grupos por tipo en el orden fijo, con columna de etiqueta de 88.
- `EntitySlot size={72}`:
  - Pokémon: arte a 64;
  - Items y Diamonds: sprite a 2x con contador de pila;
  - Pokédólares: sprite a 2x sin contador;
  - marca Shiny cuando aplica.
- Nombre accesible: «{título}, {precio}», con el título `accesible` de `listingTitle` (§9.4). El precio es el dinero real; si no hay, las opciones del juego unidas con « o », con la cifra exacta («150.000.000 Pokédólares o 400 Diamonds»); si no, «A convenir».
- `href` al detalle y `tip` con el tooltip de §9.5.9.
- Posición del tooltip: colocación `side` de §7.5.5 (a la derecha; a la izquierda si no cabe).

**Lista**
- `DataTable dense`, caption oculto «Anuncios de Comercio». Columnas y anchos a 944 (`canvas-v2/gen/gen_comercio.py:362`, `:367-369`):

| Columna | Ancho | Contenido |
|---|---|---|
| Sprite (encabezado oculto) | 72 | Caja de 48 del `ListRow`: arte (`frame="box"`) o sprite 1x con marco y pila (`frame="framed"`) |
| Anuncio | resto | Nombre enlazado al detalle, que abre el tooltip con la colocación `row` de §7.5.5. Línea secundaria: Pokémon, «{nickname} · +{boost} · Memory Slots {n} · Star Level {n}» con lo declarado; Items, «×{cantidad}» |
| Tipo | 110 | «Pokémon», «Item», «Diamonds», «Pokédólares» |
| Mundo | 74 | Nombre del mundo |
| Dinero real | 100 | Importe en 700 o «—» |
| En el juego | 176 | `PriceOptions align="center"`, con los Diamonds enlazados a su tooltip |
| Vendedor | 152 | `Rating` |
| Publicado | 100 | Relativo, 12/16 |

- La Lista no se agrupa: sigue el orden elegido. Por debajo de 944 se desplaza en horizontal (`CGS §11`).
- **Publicado relativo:** `formatRelative` de §13.3 («hace 12 min», «hace 3 h»; desde 24 h, la fecha). El HTML prerenderizado lleva `<time datetime>` con la fecha absoluta. La isla la cambia por la relativa con el reloj del cliente (inyectable en pruebas).

#### 9.5.9 Tooltip del anuncio (Slots y Lista)

`GameTooltip` de 282 con `grid`:

- **Cabeza:**
  - Pokémon: arte a 70 en caja de 72; si tiene aura, el `icono` de `content/auras.json` a 32 en la esquina; marca Shiny si aplica.
  - Otros activos: sprite a 2x. El Diamond gira.
  - Título: el nickname si existe; si no, `listingTitle(anuncio).texto` (§9.4).
- **Filas:** las claves de la tarjeta con sus valores y dos puntos. Si el título es el nickname, primero va «Pokémon:» con el nombre. Las filas sin valor se omiten (T32).
- **Secciones** plegables, abiertas por defecto:
  - «Held Items: N», cada held con su celda de 32 y «X-Attack T5»;
  - «Entrenamiento: N», cada habilidad declarada con «{nivel} ({progreso}%)» y su medidor.
- **Mercado**, tras la línea `tt-divider`:
  - «Dinero real:»;
  - «En el juego:» (`PriceOptions variant="tooltip"`);
  - «Mundo:»;
  - «Vendedor:», como «{nombre}, {nota} ({n})», o solo el nombre si no tiene reseñas;
  - «Contacto:» con las etiquetas públicas separadas por coma.
- **Pie:** «Mantén Shift para fijar».

#### 9.5.10 Vacíos

- **Conjunto vacío** (fase A en producción, o B sin anuncios):
  - `EmptyState` «Aún no hay anuncios.» / «No listings yet.», con la acción «Crear anuncio» (A) o «Publicar anuncio» (B);
  - no se renderizan búsqueda, pestañas, filtros ni barra de resultados (S11).
- **Filtros sin resultados:** `EmptyState` «Ningún anuncio coincide con estos filtros.», con la acción «Quitar filtros». La acción vacía `q`, `tipo`, `mundo`, `moneda`, `min`, `max` y `val`, y conserva orden y vista.
- **Solo búsqueda sin resultados:** «Sin resultados para «{q}».», con la misma acción.

### 9.6 Detalle del anuncio

Plantilla F (§8.0.2), con `preloadGameFont` (§3.9). {título} es `listingTitle` (§9.4).

1. `Breadcrumb` «Comunidad › Comercio › {título}».
2. `PageTitle` {título}. Debajo, en 12/16 `text-tertiary`, «{Mundo} · Publicado el {fecha}» y, si no está publicado, su estado: «Reservado», «Completado» o «Expirado».
   - Un anuncio `retirado` da 404 al público. Su vendedor y los moderadores lo ven con la línea «Retirado».
3. **Desde 768 (`md:`), dos columnas:**
   - **Izquierda:** la ficha, `GameTooltip variant="sheet"` de 282 (7.5.9: `role="group"`, `aria-label` «Ficha de {título}» con el título `accesible`, sin pie ni bloque de mercado; Poppins y tokens `tt-*`, R2). Además de las filas de §9.5.9 lleva:
     - «Addon:»;
     - «Next Boost chance:»;
     - todos los held items;
     - todas las habilidades de entrenamiento;
     - la sección «Ditto Memory: N», con cada Pokémon memorizado como `NestedEntity` con su tooltip.
   - **Derecha** (resto del ancho, 24 entre bloques):
     - `Section` «Precio»: `FactList` con Dinero real y En el juego.
     - `Section` «Vendedor»: `Rating` enlazado al perfil y «Operaciones confirmadas: N».
     - `Section` «Contacto verificado»: `ChipRow` sin tope.
     - Acciones (solo B), §9.10 y §9.11:
       - para el comprador: `Button` «Contactar al vendedor» y `TextLink` «Reportar anuncio»;
       - para el vendedor: «Editar», «Marcar como reservado» o «Marcar como disponible», «Marcar como completado», «Retirar anuncio» y, si expiró, «Renovar».
   - **Por debajo de 768:** una columna, con la ficha primero.
4. **Fase A:** sin acciones. Los canales son chips sin enlace (`DS:ContactChip`).

### 9.7 Crear y publicar anuncio

#### 9.7.1 Estructura

- **Título:** «Crear anuncio» (A) o «Publicar anuncio» (B). Con `?editar={id}` (B, solo el vendedor): «Editar anuncio».
- **Disposición** (plantilla G, §8.0.2):
  - desde 768 (`md:`), formulario a la izquierda y vista previa de 304 a la derecha, fija al desplazarse a 16 bajo la cabecera: `position: sticky; top: calc(var(--layout-header) + var(--space-16))` (la cabecera fija mide 64, §5.6);
  - por debajo, el formulario y luego la vista previa.
- **Orden del formulario:**
  1. «Tipo de activo»: `ToggleGroup variant="tab"` con los cuatro tipos, sin «Todos».
  2. Campos del activo (§9.7.2, §9.7.3). Cada tipo conserva su estado si se cambia de tipo y se vuelve.
  3. «Precio» (§9.7.4).
  4. «Mundo»: `Select` obligatorio con los mundos de `content/mundos.json` (§8.1).
  5. Acción (§9.7.7 o §9.7.8).

#### 9.7.2 Pokémon: todos los atributos

| Campo (es / en) | Control | Valores válidos | Opciones | Obligatorio | Dónde se ve |
|---|---|---|---|---|---|
| Pokémon | `Combobox` (§7.2.8) con arte de 40, nombre y «Nº 132» | id del roster | `content/pokemon.json` (910 registros hoy) | Sí | Todo |
| Ball | Combobox con texto libre | ≤ 40 caracteres | `content/items/poke-balls.json` | No | Tarjeta, tooltip, ficha |
| Aura | `ToggleGroup variant="sprite"` | «Ninguna» o id | `content/auras.json` (Alliance, Premier) | No | Tarjeta, tooltip (icono), ficha |
| Boost | `NumberField`, ayuda «De +0 a +50.» | Entero de 0 a 50 | Tope +50 de `docs/CONTENT_PLAN.md:207` | No | Tarjeta, tooltip, ficha, Lista |
| Star Level | `NumberField` | Entero de 0 a 5 | `CONTENT_PLAN.md:540` | No | Tarjeta, tooltip, ficha, Lista |
| Nickname | `TextField` | ≤ 40 caracteres, sin recortar espacios internos | — | No | Tarjeta, título del tooltip, Lista |
| Memory Slots | `NumberField`, solo si `isDittoSlug` (`draft.ts:34-36`) | Entero de 1 a 6; 1 por defecto al elegir Ditto | `TRADE_PRODUCT_PLAN.md:19` | Sí para Ditto | Tarjeta, tooltip, ficha, Lista |
| Memoria 1…N | Combobox del roster, uno por slot | id del roster o vacío | Roster | No | Ficha («Ditto Memory») y búsqueda |
| Held Items | Hasta `HELDS_MAX` filas: combobox con texto libre y `NumberField` «Tier» | Nombre ≤ 40; tier de 1 a `HELD_TIER_MAX` | `content/items/helds.json` | No | Tarjeta, tooltip, ficha |
| Addon | `Select`: «Ninguno» y los addons del Pokémon elegido. Se oculta si no tiene ninguno | id del addon | `content/outfits.json`, solo los de ese `pokemon`; nunca por especie base (`TRADE_PRODUCT_PLAN.md:37`) | No | Ficha |
| Next Boost chance | `TextField` con sufijo «%» | 0 a 100, ≤ 2 decimales (`isValidOptionalPercent`) | — | No | Ficha |
| Entrenamiento | 8 filas: `NumberField` «Nivel» y `TextField` «Progreso (%)» | Nivel: entero de 0 a 999.999 (hasta 6 cifras, como `TradeDesk.tsx:200-202`). Progreso: 0 a 100, ≤ 2 decimales | Las 8 habilidades de §9.4 | No | Tarjeta (primera), tooltip, ficha |
| NPC Price | `ToggleGroup` «Sin declarar», «Unsellable», «Importe»; con «Importe», un campo de Pokédólares | Entero ≥ 1 | — | No | Tarjeta, tooltip, ficha |

- Etiquetas: «Pokémon», «Ball», «Aura», «Boost», «Star Level», «Nickname», «Memory Slots», «Held Items», «Tier», «Addon», «Next Boost chance», «Entrenamiento» / «Training», «Nivel» / «Level», «Progreso» / «Progress», «NPC Price». Los términos del juego no se traducen (T23).
- El campo «Level» de hoy (`TradeDesk.tsx:59`, `:96`) desaparece: «Requisito» sale del roster (Q5).

#### 9.7.3 Items, Diamonds y Pokédólares

- **Items:**
  - «Item»: combobox sobre todos los items de `getItems()` (`src/lib/content/registry.ts`), con texto libre de hasta 80 caracteres. Con coincidencia exacta muestra su sprite; si el sprite es de modo `cantidad`, el fotograma sigue a la cantidad, como en `TradeDesk.tsx:262-265`. Sin coincidencia, el sprite `ui/comercio/item`.
  - «Cantidad»: entero de 1 a 15 cifras, sin agrupar o agrupado con el separador de miles del idioma («1.500» en `es`, «1,500» en `en`; `parsePositiveWhole(texto, locale)`, §9.1).
- **Diamonds:** «Cantidad», entero ≥ 1.
- **Pokédólares:**
  - «Cantidad» acepta «50kk», «2,5k» o la cifra agrupada del idioma, con `parsePokedolares` (§4.3).
  - Debajo, en vivo, la cifra exacta con su sprite («50.000.000 Pokédólares»).
  - `parsePokedolares` no redondea (§4.3): `motivo: 'fraccion'` («1,2345k») da el error «Esa cantidad no es un número entero de Pokédólares.»; `'formato'` y `'rango'`, el de cantidad (§9.7.5).

#### 9.7.4 Precio

`fieldset` «Precio»:
- **«Dinero real»:** `Select` de moneda (R$, US$, MX$) y `TextField` de importe: > 0, hasta 10 cifras enteras y 2 decimales, con coma o punto como separador decimal (`draft.ts:47-48`).
- **«En el juego»:** de 0 a 2 opciones. Cada una tiene un `Select` de tipo (Pokédólares, Diamonds), un importe y el botón «Quitar opción». «Añadir otra opción» aparece solo con una opción.
- **Checkbox «A convenir»:** desactiva y vacía las dos partes.
- **Reglas:**
  1. hay dinero real, al menos una opción en el juego, o «A convenir»;
  2. dos opciones del juego son de tipos distintos;
  3. un anuncio de Diamonds no admite una opción en Diamonds, y uno de Pokédólares no admite una en Pokédólares.

La lista de monedas reales es una constante de `src/lib/trade/types.ts` (Q9).

#### 9.7.5 Validación (A16)

- Cada campo valida tras su primera interacción.
- Al pulsar la acción con errores:
  - se valida todo y el foco va al primer campo con error;
  - si el error está en una sección plegada, la sección se abre.
- Cada error:
  - es un texto bajo su campo, unido con `aria-describedby`;
  - el campo lleva `aria-invalid="true"`.

| Caso | es | en |
|---|---|---|
| Sin Pokémon válido | «Elige un Pokémon de la lista.» | «Choose a Pokémon from the list.» |
| Entero fuera de rango | «Escribe un número de {min} a {max}.» | «Enter a number from {min} to {max}.» |
| Porcentaje | «Escribe un porcentaje de 0 a 100, con hasta 2 decimales.» | «Enter a percentage from 0 to 100, up to 2 decimals.» |
| Cantidad | «Escribe una cantidad entera mayor que cero.» | «Enter a whole amount above zero.» |
| Pokédólares no exactos | «Esa cantidad no es un número entero de Pokédólares.» | «That amount isn't a whole number of Pokédollars.» |
| Sin precio | «Indica un precio o marca «A convenir».» | «Enter a price or choose “Negotiable”.» |
| Opción repetida o del mismo activo | «Esa opción de precio no es válida para este anuncio.» | «That price option isn't valid for this listing.» |
| Sin mundo | «Elige un mundo.» | «Choose a world.» |

#### 9.7.6 Vista previa

- Es la `ListingCard` real, con `layout = listingLayout([borrador])`, y se actualiza en vivo.
- El título no enlaza.
- La meta dice «{Mundo} · ahora».
- **Fase A:** el pie solo lleva las filas de precio, porque no hay cuenta.
- **Fase B:** lleva además vendedor y canales de la cuenta.

#### 9.7.7 Fase A: copiar

- **Acción:** `Button` «Copiar anuncio».
- **Si la copia funciona:** `Notice` «Anuncio copiado.»
- **Si falla:** `Notice` «No se pudo copiar. Selecciona el texto de abajo y cópialo.» y, debajo, un `textarea` de solo lectura con el texto, etiquetado «Texto del anuncio». El `textarea` solo existe en ese caso.
- **Borrador:** el formulario se guarda por visitante en `localStorage` (`alliance-codex:comercio:borrador:v1`, lecturas y escrituras en `try/catch`) en cada cambio, como en la fase B (§9.7.8), y se restaura al volver. Así salir no pierde datos y la página no lleva ningún aviso sobre guardar (el texto «…aún no se publica ni guarda» de `TD:111` no reaparece en ninguna forma, §12.16). Si el almacenamiento falla, el formulario funciona igual sin restaurar.
- **Texto copiado**, en el idioma de la página, una línea por dato y en el orden de la ficha:

```
Vendo: Shiny Ditto
Nickname: S U S A N O O
Ball: Premier Ball
Aura: Premier
Boost: +20
Memory Slots: 6
Held Items: X-Attack T5, X-Lucky T3
Entrenamiento: Attack 16 (53%)
Ditto Memory: Charizard, Gengar
Dinero real: R$ 90
En el juego: 150kk o 400 Diamonds
Mundo: Sun
```

(Ejemplo de formato, no de datos.)
- Los datos no declarados no generan línea.
- Pokédólares: la forma corta solo si es exacta (`compactKks`, `draft.ts:22-26`); si no, la cifra exacta agrupada con `formatInteger` (E12).
- En `en`: «Selling:», «Real money:», «In-game:», «or», «World:».

#### 9.7.8 Fase B: publicar y gestionar

- **Acción `Button` «Publicar»:**
  - llama a `trade_publish_listing` (§9.12.3);
  - si funciona, lleva al detalle y muestra `Notice` «Anuncio publicado.»;
  - cada error del servidor se asocia a su campo o, si no es de un campo, a un `Notice` persistente.
- **Sin requisitos cumplidos** (§9.9):
  - en lugar de la acción, una línea «Para publicar necesitas una cuenta con correo y teléfono verificados y al menos un canal de contacto verificado.» y el `Button` «Ir a mi cuenta»;
  - el formulario sigue usable;
  - el borrador se guarda por visitante en `localStorage` (`alliance-codex:comercio:borrador:v1`, lecturas y escrituras en `try/catch`), como en la fase A (§9.7.7), y se borra al publicar.
- **Vigencia:** 14 días desde que se publica o se renueva (`ANUNCIO_DIAS_VIGENCIA`).
  - Un anuncio cuya `expira` quedó atrás se trata como `expirado` en políticas y vistas, sin tarea programada.
  - «Renovar» lo vuelve a publicar con una vigencia nueva.
- **Editar:** no cambia el tipo ni `publicado`.
- **Estados que el vendedor puede fijar:**
  - `publicado` ↔ `reservado`;
  - `publicado` o `reservado` → `completado` o `retirado`;
  - `expirado` → `publicado` (renovar).
- **Límites** (constantes del servidor, §9.12.6): 20 anuncios activos por vendedor y 10 anuncios nuevos por 24 h.

### 9.8 Perfil del vendedor

1. `Breadcrumb` «Comunidad › Comercio › {nombre}».
2. `PageTitle` {nombre}.
3. Fila de datos, en 14/32 con etiqueta en 700, como la cabecera de `Lienzo:Guild`:
   - «Miembro desde: 09/2026»;
   - «Operaciones confirmadas: N»;
   - «Valoración: 4.6 de 5 (23 reseñas)» o «Valoración: sin reseñas».
4. `Section` «Contacto verificado»: `ChipRow` sin tope.
5. `Section` «Anuncios»:
   - `Count`, `ViewToggle` y las tres vistas con los mismos componentes de §9.5.8, sin filtros;
   - solo anuncios `publicado` y `reservado`;
   - 24 por página;
   - sin anuncios: `EmptyState` «Sin anuncios activos.»
6. `Section` «Reseñas»:
   - `DataTable` con caption oculto «Reseñas por puntuación»: columnas «Puntuación» (filas 5, 4, 3, 2, 1 y 0) y «Reseñas» (cuenta; 0 es una cifra real).
   - Lista de reseñas, de la más reciente a la más antigua, 10 por página. Cada una es un `article` con:
     - «{n} de 5» en 700, el comprador (su handle) y la fecha;
     - «Operación: {título}», donde el Pokémon o el item es un `NestedEntity` con su tooltip;
     - el comentario, si lo hay.
     - Las evidencias nunca se muestran en público (§9.10).
7. `TextLink` «Reportar vendedor» (B).

Plantilla H (§8.0.2). Con «Todos», los grupos de tipo de «Anuncios» son `h3` y los títulos de tarjeta `h4` (7.6.2).

**Fase A:** los datos salen de `tests/fixtures/comercio/vendedores.json` (solo con `COMERCIO_DEMO=1`). La valoración se calcula de sus `resenas`.

**Fase B:** el público no lee `trade_transactions` ni `reviewer_id` (§9.12.2). La fila de datos y la tabla de puntuaciones salen de `trade_seller_stats(seller_id)` (reseñas, media, `d0`…`d5` y operaciones confirmadas como vendedor); la lista, de `trade_public_reviews(seller_id)`, que da cada reseña visible con el handle del comprador («Cuenta eliminada» / «Deleted account» si ya no existe) y el tipo y el activo del anuncio para «Operación: {título}» (§9.12.3). El detalle del anuncio toma «Operaciones confirmadas: N» de la misma función.

### 9.9 Cuenta, verificación y canales

Flujo general de cuenta, reutilizado por Guild (`TRADE_PRODUCT_PLAN.md:46`). Supabase Auth con correo y contraseña; hoy lo usa `GuildPersistencePanel.tsx:224-225`. La ruta es `/{locale}/cuenta/`, con estas `Section`. Sin `COMERCIO_PUBLICO` solo existen «Acceso», la fila de correo de «Verificación», «Guilds» y «Eliminar cuenta»:

- **«Acceso»:**
  - `ToggleGroup` «Entrar» / «Crear cuenta», «Correo», «Contraseña» (mínimo 8 caracteres) y CAPTCHA (D-B3);
  - «¿Olvidaste tu contraseña?» → `resetPasswordForEmail`;
  - «Cerrar sesión».
- **«Verificación»:**
  - «Correo: verificado» o «Correo: sin verificar», con la acción «Reenviar correo».
  - «Teléfono: verificado (+55 ••• ••• 1234)» o «Teléfono: sin verificar», con el formulario:
    1. `Select` de país con su código;
    2. «Número»;
    3. «Enviar código», que llama a `updateUser({ phone })`;
    4. «Código» de 6 dígitos;
    5. «Verificar», que llama a `verifyOtp({ phone, token, type: 'phone_change' })`.

    Así lo describe `TRADE_PRODUCT_PLAN.md:48`. «Cambiar teléfono» repite el flujo. El teléfono se guarda en E.164.
- **«Perfil de Comercio»:**
  - «Handle»: 3 a 24 caracteres `[a-z0-9_-]`, único sin distinguir mayúsculas; no cambia después del primer anuncio.
  - «Nombre visible»: 1 a 32 caracteres.
  - Hace falta para publicar y para contactar.
- **«Canales de contacto»:** una fila por canal, con su `ContactChip`, su estado («Verificado» o «Pendiente») y la casilla «Mostrar en mis anuncios». Acciones:
  - Correo: automático con el correo verificado de la cuenta. Otro correo no cuenta como canal.
  - Teléfono: automático con el teléfono verificado.
  - «Vincular Discord» y «Vincular Twitch»: `linkIdentity({ provider })`, que exige activar la vinculación manual, hoy `enable_manual_linking = false` en `supabase/config.toml:179` (D-B4). Tras volver del proveedor, `trade_sync_oauth_channels()` crea el canal verificado con el nombre de usuario de `auth.identities`.
  - «Añadir otra plataforma»:
    1. el vendedor escribe la plataforma (≤ 32) y el usuario;
    2. el sistema genera un código;
    3. el vendedor lo pone en su perfil público de esa plataforma;
    4. un moderador lo comprueba (§9.11). Hasta entonces el canal está «Pendiente» y no se muestra (D-B5).
  - «Desvincular».
- **«Guilds»:** §10.4.
- **«Eliminar cuenta»:**
  - pide confirmación en un `Dialog` (§7.2.8) con título «¿Eliminar tu cuenta?» / «Delete your account?», el texto «Se borran tu cuenta, las {n} guilds de las que eres propietario con sus cortes y tu acceso a las demás. No se puede deshacer.» / «This deletes your account, the {n} guilds you own with their snapshots, and your access to other guilds. This can't be undone.» (sin guilds propias, sin esa parte: «Se borran tu cuenta y tu acceso a las guilds. No se puede deshacer.» / «This deletes your account and your guild access. This can't be undone.»); con `COMERCIO_PUBLICO`, además «Tus anuncios se retiran y tus reseñas quedan con el autor «Cuenta eliminada».» / «Your listings are withdrawn and your reviews show “Deleted account” as the author.»; botones «Eliminar cuenta» / «Delete account» y «Cancelar» / «Cancel», con el foco inicial en «Cancelar»;
  - una Edge Function con `service_role` borra las guilds de las que la cuenta es propietaria (`guilds.owner_user_id` no tiene `on delete cascade`, `202609090004_phase2_content_guild_rls.sql:81`, así que sin este paso el borrado del usuario falla; las tablas de la guild caen en cascada), pasa sus anuncios a `retirado`, borra canales y perfil, y por último el usuario (`auth.admin.deleteUser`, que borra sus membresías en cascada, `:96`);
  - sus reseñas escritas quedan con el autor «Cuenta eliminada».
- Estados de la isla: hasta conocer la sesión, las secciones no se pintan y la región lleva `aria-busy="true"`; un error de red o de Supabase se muestra con `Notice` y el texto de `mapSupabaseError` (§12.14.1), con el botón «Reintentar» / «Retry».

**Etiqueta pública de un canal:** «Correo», «Teléfono +{código de país}», «Discord», «Twitch» o «{Plataforma}». En público solo se ven los canales verificados con «Mostrar en mis anuncios» activado, y solo su etiqueta. El valor (correo, número, usuario) nunca es público (`TRADE_PRODUCT_PLAN.md:22`, `:46`): solo lo ve la otra parte de una operación (§9.10) y los moderadores.

**Requisitos por acción,** impuestos en las funciones de §9.12.3 y no solo en la interfaz:

| Acción | Requisito |
|---|---|
| Ver lista, detalle y perfiles; crear y copiar (A) | Ninguno |
| Publicar, editar o renovar un anuncio | Sesión, correo y teléfono verificados, perfil de Comercio, ≥ 1 canal verificado visible, sin suspensión |
| Contactar al vendedor (iniciar operación) | Sesión, correo y teléfono verificados, perfil de Comercio, sin suspensión |
| Confirmar, cancelar o disputar una operación; reseñar | Ser parte de la operación y cumplir la fila anterior |
| Reportar | Sesión y correo verificado |
| Moderar | Fila en `trade_moderators` |

La verificación del contacto no es verificación de identidad ni garantía de un trato seguro (`TRADE_PRODUCT_PLAN.md:46`). La interfaz no dice «confiable», «seguro» ni «garantizado» (§12.22).

### 9.10 Operaciones y reseñas

La reseña pertenece a una operación, no al vendedor (`TRADE_PRODUCT_PLAN.md:50`). Como el sitio no procesa el pago, una operación solo cuenta si la confirman las dos partes.

| Estado | Se llega con | Quién | Efecto |
|---|---|---|---|
| `contacto` | «Contactar al vendedor» en el detalle | Comprador | Cada parte ve los valores de los canales visibles de la otra (`trade_transaction_contacts`) |
| `confirmada_vendedor` / `confirmada_comprador` | «Operación completada» | La parte que confirma | Queda esperando a la otra |
| `confirmada` | La segunda confirmación | La otra parte | El comprador puede reseñar durante 30 días (`RESENA_DIAS`) |
| `cancelada` | «Cancelar» antes de `confirmada` | Cualquiera | Cierra la operación, sin reseña |
| `disputada` | «No se completó», cuando la otra parte ya confirmó | La parte que no confirmó | Pasa a moderación; no admite reseña |
| `caducada` | 30 días sin cambio antes de `confirmada`, calculado sin tarea programada | — | Sin reseña |

- **Restricciones de la operación:**
  - comprador distinto del vendedor;
  - como máximo una operación abierta por anuncio y comprador;
  - el anuncio está `publicado` o `reservado`;
  - como máximo 20 operaciones nuevas por comprador en 24 h.
- «Mis operaciones», `/{locale}/cuenta/operaciones/` (antes `/{locale}/comercio/operaciones/`, que ahora es un 302):
  - `ToggleGroup` «Compras» / «Ventas»;
  - `DataTable` con columnas «Anuncio» (`NestedEntity`), «Contraparte», «Estado», «Fecha», «Contacto» y «Acciones». La columna «Contacto» tiene los valores revelados como texto, cada uno con el botón «Copiar». «Acciones» tiene los botones válidos para ese estado y ese rol.
- **Reseña:**
  - solo del comprador al vendedor, con la operación `confirmada` y dentro de `RESENA_DIAS`;
  - una por operación, nunca sobre uno mismo;
  - «Puntuación»: `ToggleGroup` «0» a «5», obligatoria, entera; el 0 vale;
  - «Comentario»: opcional, ≤ 1000 caracteres;
  - «Capturas»: hasta 3 imágenes PNG, JPEG o WebP de ≤ 5 MB. Se guardan en un bucket privado (§9.12.5) y solo las ven comprador, vendedor y moderadores, mediante URL firmada.
- **Edición:** el autor puede editar durante 7 días. Cada edición guarda la versión anterior en `trade_review_revisions`. Pasado el plazo, solo la moderación la oculta o la restaura.
- **Valoración del vendedor** (en la fase B, `trade_seller_stats`, §9.12.3):
  - media de las reseñas visibles (todas son de operaciones `confirmada`), redondeada a 1 decimal (mitad hacia arriba);
  - se muestra con el número de reseñas y, en el perfil, con la distribución (`TRADE_PRODUCT_PLAN.md:50`);
  - sin reseñas no hay nota (`DS:Rating`).
- **Fuera de alcance** (§15): respuesta del vendedor a una reseña, reseña del vendedor al comprador y avisos por correo.

### 9.11 Reportes y moderación

- **Reportar** (`Dialog`, §7.2.8), con título «Reportar anuncio», «Reportar vendedor» o «Reportar reseña»:
  - `RadioGroup` «Motivo»: «Estafa o intento de estafa», «Datos personales expuestos», «Contenido ofensivo», «Anuncio falso o duplicado», «Otro»;
  - `Textarea` «Detalle»: obligatorio con «Otro», ≤ 1000 caracteres;
  - `Button` «Enviar reporte», y después `Notice` «Reporte enviado.»;
  - un reporte por cuenta y objetivo; el segundo responde «Ya reportaste esto.»;
  - como máximo 10 reportes por cuenta en 24 h.
- **`/{locale}/comercio/moderacion/`** (solo moderadores):
  - `ToggleGroup` «Abiertos» / «Resueltos».
  - `DataTable` con columnas:
    - «Fecha»;
    - «Objetivo», con enlace;
    - «Motivo»;
    - «Reportes», con los abiertos sobre ese objetivo;
    - «Detalle»;
    - «Acciones»: «Retirar anuncio», «Ocultar reseña» o «Restaurar reseña», «Suspender vendedor» (7 días, 30 días o indefinida), «Levantar suspensión» y «Descartar».
  - Cada acción pide un «Motivo» obligatorio y escribe una fila en `trade_moderation_events`, que solo admite inserciones.
  - Una segunda tabla, «Canales pendientes», aprueba o rechaza las verificaciones manuales de §9.9.
- **Efectos:**
  - **Anuncio retirado:** sale de toda vista pública. Su vendedor ve «Retirado por moderación: {motivo}».
  - **Suspensión:** bloquea publicar, contactar y reseñar, oculta los anuncios del vendedor y hace que su perfil dé 404 mientras dure.
  - **Reseña oculta:** deja de contar para la media.
  - **Operación disputada:** la resuelve un moderador. Pasa a `confirmada` o a `cancelada`, con su evento.

### 9.12 Supabase (fase B)

Migración local `supabase/migrations/<AAAAMMDDhhmmss>_trade_marketplace.sql`. Nunca se aplica en remoto (§0). Sigue el patrón de permisos de `supabase/migrations/20260910084452_restrict_guild_rpc_execute.sql`. Añade `create extension if not exists pg_trgm with schema extensions` para la búsqueda: hoy la única extensión es `pgcrypto`, en `202609090001_phase2_extensions_enums.sql:4`.

#### 9.12.1 Tablas

| Tabla | Columnas clave y restricciones |
|---|---|
| `trade_profiles` | `user_id` pk → `auth.users` (on delete cascade); `handle` único por `lower(handle)`, check `^[a-z0-9_-]{3,24}$`; `display_name` 1–32; `created_at`; `suspended_until` null |
| `trade_contact_channels` | `channel_id`; `user_id`; `kind` enum (`email`, `phone`, `discord`, `twitch`, `other`); `platform` (obligatoria con `other`); `value`; `public_label`; `shared` bool; `verified_at` null; `verification_code_hash` null; único (`user_id`, `kind`, `platform`) |
| `trade_listings` | `listing_id`; `seller_id`; `asset_type` enum; `world_key`; `status` enum (§9.4); `asset` jsonb validado por `trade_validate_asset(asset_type, asset)` con los rangos de §9.4 y §9.7; `fiat_currency` check en (`BRL`, `USD`, `MXN`); `fiat_amount numeric(12,2)` > 0; `game_prices` jsonb (0–2, reglas de §9.7.4); `negotiable`; check de §9.7.4; `search_text`, calculado por trigger con §9.5.2 e índice trigram; `created_at`, `published_at`, `expires_at`, `updated_at`; índices (`status`, `published_at desc`) y (`seller_id`) |
| `trade_transactions` | `transaction_id`; `listing_id`; `seller_id`; `buyer_id`, check `<> seller_id`; `status` enum (§9.10); `created_at`, `seller_confirmed_at`, `buyer_confirmed_at`, `closed_at`; único parcial (`listing_id`, `buyer_id`) con `status` abierto |
| `trade_reviews` | `review_id`; `transaction_id` único; `listing_id`; `reviewer_id` → `auth.users` (on delete set null); `seller_id`; `score smallint` check 0–5; `comment` ≤ 1000; `created_at`, `updated_at`; `hidden` bool. Toda fila es de una operación `confirmada` por construcción: solo la crea `trade_submit_review`, que lo comprueba, y una operación `confirmada` no cambia de estado (§9.10) |
| `trade_review_revisions` | `review_id`; `score`; `comment`; `replaced_at` |
| `trade_review_evidence` | `review_id`; `object_path`; `mime` check (png, jpeg, webp); `bytes` ≤ 5.242.880; `width`, `height`; `created_at` |
| `trade_reports` | `reporter_id`; `target_type` enum (`listing`, `seller`, `review`); `target_id`; `reason` enum; `detail` ≤ 1000; `status` (`open`, `resolved`, `dismissed`); `resolved_by`, `resolved_at`; único (`reporter_id`, `target_type`, `target_id`) |
| `trade_moderation_events` | `moderator_id`; `action` enum; `target_type`; `target_id`; `reason` not null; `created_at`. Sin update ni delete |
| `trade_moderators` | `user_id` pk. Solo la edita el propietario por SQL |
| (sin vista de valoraciones) | Una vista `security_invoker` no sirve: el anónimo no lee `trade_transactions` ni `reviewer_id`, así que la vista vendría vacía. La valoración y las reseñas públicas salen de las funciones de lectura `trade_seller_stats` y `trade_public_reviews` (§9.12.3) |

Ninguna tabla guarda procedencia (R6). `verified_at` es estado del producto y nunca se muestra.

#### 9.12.2 RLS

Todas con RLS activado y deny por defecto. Se revoca `insert`, `update` y `delete` a `anon` y `authenticated` en todas: toda escritura pasa por las funciones de §9.12.3.

| Lectura | anon | Autenticado | Vendedor (dueño) | Contraparte | Moderador |
|---|---|---|---|---|---|
| `trade_listings` | `status` en (`publicado`, `reservado`, `completado`, `expirado`) y vendedor sin suspensión | Igual | Además los suyos, en cualquier estado | Igual que autenticado | Todo |
| `trade_profiles` (`handle`, `display_name`, `created_at`) | Sin suspensión | Igual | El suyo completo | Igual | Todo |
| `trade_contact_channels` | Solo las columnas (`channel_id`, `user_id`, `kind`, `platform`, `public_label`), por privilegio de columna, donde `shared` y `verified_at is not null` | Igual | `value` solo por `trade_my_channels()` | `value` solo por `trade_transaction_contacts(id)` | Todo |
| `trade_transactions` | Nada | Nada | Las suyas | Las suyas | Todo |
| `trade_reviews` | Nada: la lectura pública pasa por `trade_public_reviews` y `trade_seller_stats` | Igual | Las de sus ventas, ocultas incluidas | Las suyas como autor | Todo |
| `trade_review_evidence`, `trade_reports`, `trade_moderation_events` | Nada | Nada | Evidencias de sus reseñas (vendedor y autor); sus reportes | Igual | Todo |

**Pruebas (§14):** sobre `supabase start` local, con seis personas: anónimo, autenticado sin verificar, vendedor, comprador con operación, tercero verificado y moderador. Casos mínimos:
- anon no lee `value`;
- anon no lee `trade_reviews` ni `trade_transactions` directamente, y sí obtiene de `trade_public_reviews` las reseñas no ocultas de un vendedor sin suspensión, con el handle del comprador y sin `reviewer_id`; `trade_seller_stats` le devuelve la misma media y el mismo recuento que ve el moderador sobre esas reseñas;
- sin verificar, `trade_publish_listing` falla con `42501`;
- un tercero no lee operaciones ajenas;
- no se puede reseñar sin `confirmada`;
- una segunda reseña de la misma operación falla por unicidad;
- `score` 6 falla el check;
- un suspendido no publica;
- el vendedor no se reseña a sí mismo;
- solo un moderador escribe `trade_moderation_events`.

#### 9.12.3 Funciones

Todas son `security definer` con `set search_path = ''`. `execute` se concede solo a `authenticated`, salvo las dos de lectura pública.

- **Lectura pública** (`stable`, `execute` a `anon` y `authenticated`; devuelven vacío si el vendedor está suspendido):
  - `trade_seller_stats(seller_id)` → `reviews`, `average` (1 decimal, mitad hacia arriba), `d0`…`d5` sobre las reseñas no ocultas, y `confirmed_transactions` (operaciones `confirmada` como vendedor);
  - `trade_public_reviews(seller_id, limit, offset)` → por reseña no oculta, de la más reciente a la más antigua: `score`, `comment`, `created_at`, `updated_at`, `reviewer_handle` (`handle` de `trade_profiles`, o `null` si la cuenta ya no existe o no tiene perfil) y `asset_type` y `asset` del anuncio. Nunca devuelve `reviewer_id`, evidencias ni contactos.

- **Guarda:**
  - `trade_is_verified(uid)`: `email_confirmed_at` y `phone_confirmed_at` no nulos en `auth.users`, perfil existente y sin suspensión.
- **Anuncios:**
  - `trade_publish_listing(p jsonb) returns uuid`;
  - `trade_update_listing(id, p)`;
  - `trade_set_listing_status(id, status)`, con las transiciones de §9.7.8.
- **Operaciones:**
  - `trade_start_transaction(listing_id) returns uuid`;
  - `trade_confirm_transaction(id)`;
  - `trade_cancel_transaction(id)`;
  - `trade_dispute_transaction(id, detail)`;
  - `trade_transaction_contacts(id)`.
- **Reseñas:** `trade_submit_review(transaction_id, score, comment)` y `trade_update_review(id, score, comment)`.
- **Canales:**
  - `trade_my_channels()`;
  - `trade_upsert_channel(...)`;
  - `trade_sync_oauth_channels()`;
  - `trade_request_channel_code(channel_id)`.
- **Reportes:** `trade_report(target_type, target_id, reason, detail)`.
- **Moderación:**
  - `trade_moderate(action, target_type, target_id, reason, until)`;
  - `trade_verify_channel(channel_id, approve)`.
  - Comprueban `trade_moderators`.

Cada función comprueba sus requisitos (§9.9) y sus límites (§9.12.6). Si falla, lanza `42501` (permiso) o `22023` (valor), con un mensaje fijo que la isla traduce.

#### 9.12.4 Auth: estado local y cambios

| Ajuste | Hoy | Fase B |
|---|---|---|
| Confirmación de correo | `enable_confirmations = false` (`supabase/config.toml:225`) | `true`, con SMTP propio (D-B2) |
| SMS | `[auth.sms] enable_confirmations = false` (`:260`); proveedores admitidos: `twilio`, `twilio_verify`, `messagebird`, `textlocal`, `vonage` (`:287`) | Uno activado (D-B1) |
| CAPTCHA | Comentado; admite `hcaptcha` o `turnstile` (`:212-215`) | Activado (D-B3) |
| Vinculación manual | `enable_manual_linking = false` (`:179`) | `true` |
| Discord y Twitch | Disponibles en la lista de proveedores (`:318-320`) | Activados, con apps OAuth del propietario (D-B4) |
| Longitud mínima de contraseña | `minimum_password_length = 6` (`:181`) | `8` |

El proyecto remoto se configura en el panel de Supabase. Lo hace el propietario.

#### 9.12.5 Evidencias

- Bucket privado `trade-evidence`, con rutas `{review_id}/{evidence_id}.{ext}`.
- Políticas de `storage.objects`:
  - insert, solo el autor de la reseña;
  - select, autor, vendedor de la operación y moderadores.
- URLs firmadas de 60 s.
- Una Edge Function valida MIME por firma, dimensiones y tamaño, y quita los metadatos antes de registrar la fila (`TRADE_PRODUCT_PLAN.md:52`).

#### 9.12.6 Parámetros

Constantes en un solo módulo SQL y en `src/lib/trade/limits.ts`, con valor por defecto. El propietario puede cambiarlas (D-B6):

| Parámetro | Valor |
|---|---|
| `ANUNCIO_DIAS_VIGENCIA` | 14 |
| Anuncios activos por vendedor | 20 |
| Anuncios nuevos por 24 h | 10 |
| Operaciones nuevas por 24 h | 20 |
| Reportes por 24 h | 10 |
| `RESENA_DIAS` | 30 |
| Edición de reseña | 7 días |
| Caducidad de operación | 30 días |

### 9.13 Decisiones del propietario para la fase B

No bloquean la fase A. Sí bloquean el lanzamiento de la fase B.

| ID | Decisión | Opciones | Mientras no responda |
|---|---|---|---|
| D-B1 | Proveedor de SMS para verificar el teléfono, y su presupuesto | `twilio`, `twilio_verify`, `messagebird`, `textlocal`, `vonage` | La fase B funciona en local con `[auth.sms.test_otp]`. No hay lanzamiento público |
| D-B2 | SMTP de los correos de Auth | Cualquier SMTP; el de Supabase tiene límite de envío | Solo local |
| D-B3 | CAPTCHA | hCaptcha o Turnstile | Solo local |
| D-B4 | Apps OAuth de Discord y Twitch | Las crea el propietario en cada portal | Sin «Vincular Discord» ni «Vincular Twitch» |
| D-B5 | «Otras plataformas»: cuáles y cómo se verifican | Código en el perfil público, revisado por un moderador (§9.9), u otra | Sin «Añadir otra plataforma» |
| D-B6 | Moderadores y parámetros de §9.12.6 | — | Valores por defecto; sin moderador no hay lanzamiento |
| D-B7 | Términos de la comunidad, edad mínima y política de privacidad; revalidar los términos de PokeAlliance (D-009) | Textos del propietario | Sin lanzamiento |

### 9.14 Criterios de aceptación de Comercio

1. **CA-9.1** Sin `COMERCIO_DEMO` y sin `COMERCIO_PUBLICO` (el build de producción), con o sin `OCULTAR_BORRADORES`, `/es/comercio/` y `/en/comercio/`:
   - no tienen `ListingCard`, `EntitySlot` de anuncio ni filas de anuncio;
   - no tienen búsqueda, pestañas, filtros, `InfoBanner` ni barra de resultados;
   - tienen «Aún no hay anuncios.» / «No listings yet.» y un enlace «Crear anuncio» / «Create listing» a `/comercio/publicar/`.
   - No se generan rutas `/comercio/anuncio/*` ni `/comercio/vendedor/*`, ni `/comercio/datos.json`.
   - Ningún archivo de `.vercel/output/` contiene un `id` de `tests/fixtures/comercio/anuncios.json` ni un nombre de `vendedores.json`.
2. **CA-9.2** Con `COMERCIO_DEMO=1`, en Cards con «Todos»:
   - los grupos aparecen en el orden Pokémon, Items, Diamonds, Pokédólares, y un tipo sin anuncios en la página no aparece;
   - cada rejilla cumple S2.
3. **CA-9.3** Elegir «Pokémon» actualiza la URL con `?tipo=pokemon` sin añadir una entrada al historial (`history.length` no cambia, H1), el conteo con el número del registro y cierra cualquier tooltip.
4. **CA-9.4** Con «Precio, menor primero», los anuncios quedan agrupados por moneda (R$, US$, MX$, Pokédólares, Diamonds) y ascendentes dentro de cada grupo; «A convenir» va al final (prueba unitaria de `sortListings` y e2e).
5. **CA-9.5** Con «Moneda: Todas», los campos de «Precio» están `disabled` y la leyenda es «Precio (elige moneda)». Con «Pokédólares», «Mín 50kk» excluye los anuncios con precio en Pokédólares por debajo de 50.000.000.
6. **CA-9.6** Búsqueda (prueba unitaria de `searchText` y `matches`):
   - «+20» solo devuelve anuncios con Boost 20;
   - «susanoo» encuentra el nickname «S U S A N O O»;
   - «50kk» encuentra el anuncio de 50.000.000 Pokédólares;
   - «premier» encuentra ball o aura Premier.
7. **CA-9.7** En cada página, las tres vistas muestran el mismo conjunto y, dentro de cada tipo, el mismo orden; la Lista, que no agrupa, sigue el orden elegido (S4). En Slots, cada `aria-label` es «{título accesible}, {precio}» (§9.4). En Lista hay 8 columnas con los anchos de §9.5.8 a 1440.
8. **CA-9.8** Pasar el puntero sobre el `article` de una `ListingCard` no abre tooltip. Pasar sobre su Ball, un elemento, un held o un importe de Diamonds sí (S3).
9. **CA-9.9** En el tooltip de un anuncio de Pokémon con nickname, el título es el nickname y la primera fila es «Pokémon:». El bloque de mercado tiene «Contacto:» con etiquetas públicas y nunca un valor (correo, número o usuario).
10. **CA-9.10** Cada importe de Pokédólares visible en lista, detalle, perfil y vista previa lleva antes el sprite `ui/pokedolares`, y su nombre accesible es la cifra exacta (S8). En las páginas de Comercio no aparecen «KK», «KKs» ni «gold».
11. **CA-9.11** Formulario:
    - Memory Slots y las memorias aparecen solo con Ditto o Shiny Ditto;
    - Boost 51 muestra «Escribe un número de 0 a 50.» y 50 es válido;
    - «Addon» se oculta si el Pokémon elegido no tiene addons en `content/outfits.json`;
    - un anuncio de Diamonds con una opción en Diamonds da el error de opción no válida;
    - al pulsar la acción con errores, el foco va al primer campo inválido.
12. **CA-9.12** «Copiar anuncio» copia exactamente el texto de §9.7.7 para el anuncio de prueba (prueba unitaria de `listingText`). El `textarea` no existe mientras la copia funciona.
13. **CA-9.13** Con `COMERCIO_PUBLICO` desactivado, el HTML de todas las rutas de Comercio no tiene «Contactar al vendedor», «Reportar», «Publicar» ni enlaces a `/cuenta/` (que incluye `/cuenta/operaciones/`) o `/comercio/moderacion/`.
14. **CA-9.14** (fase B) Pasan todas las pruebas RLS de §9.12.2 con las seis personas.
15. **CA-9.15** (fase B) Una reseña solo se crea con la operación `confirmada`, por el comprador y dentro de 30 días. La media, la distribución y «Operaciones confirmadas» que muestra el perfil a un visitante anónimo coinciden con `trade_seller_stats` y excluyen reseñas ocultas; cada reseña muestra el handle del comprador de `trade_public_reviews`.
16. **CA-9.16** (fase B) Tras «Contactar al vendedor», el comprador ve los valores de los canales visibles del vendedor. Un tercero autenticado, en el mismo anuncio, solo ve etiquetas.
17. **CA-9.17** axe sin violaciones `serious` ni `critical` en lista (tres vistas), detalle, perfil, formulario con errores y, en la fase B, cuenta, operaciones y moderación (S12).
18. **CA-9.18** Dos builds (`scripts/test/build-comercio-fases.mjs`, con y sin `COMERCIO_PUBLICO`, los dos con `COMERCIO_DEMO=1`): sin la variable existen `.vercel/output/static/es/comercio/index.html` y los HTML de detalle y perfil, y `config.json` no envía `/es/comercio/` a `_render`; con ella no existen esos HTML, `config.json` envía la lista, el detalle, el perfil y `moderacion` a `_render`, y `operaciones` existe. Una página de Comercio que exporte `prerender` hace fallar el build.
19. **CA-9.19** `listingTitle` (prueba unitaria): «Shiny Ditto», «Fire Stone», «300 Diamonds» y, para 50.000.000 Pokédólares, `texto` «50kk Pokédólares» y `accesible` «50.000.000 Pokédólares» (en `en`, «50kk Pokédollars» y «50,000,000 Pokédollars»). En el detalle de ese anuncio, el nombre accesible del h1 y el `<title>` llevan la cifra exacta.
20. **CA-9.20** Con el reloj fijado después de `expira` de un anuncio `publicado`, ese anuncio no aparece en la lista ni en el perfil, y su detalle muestra «Expirado» sin acciones.

### 9.15 Registro, confianza y seguridad (decisiones del propietario, 2026-09-23)

Decidido por el propietario el 2026-09-23. Esta sección manda sobre §9.9–§9.12 y §9.14 donde choquen; lo que no toca sigue vigente. Resumen de los cambios: la cuenta pide más datos y se ancla a Discord o Google en lugar del teléfono (el SMS queda construido y apagado por costo); Comercio exige 18 años, Discord con 60 días de antigüedad y un consentimiento para dinero real; las reseñas van en los dos sentidos, sin capturas, con una media que cuenta a cada contraparte una sola vez; hay estado en línea; la moderación recibe alertas de patrones fuertes; el baneo es solo de Comercio y deja ocupados los identificadores de la cuenta.

#### 9.15.1 Registro (toda cuenta)

- **Edad mínima de la cuenta:** 13 años (`EDAD_MINIMA_CUENTA`). Comercio exige 18 (§9.15.2). La wiki no pide cuenta.
- **Tres pasos**, en `/{locale}/cuenta/`; la cuenta no se activa hasta completar los tres y, antes, solo se ven los pasos:
  1. **Correo y contraseña:** «Correo», «Contraseña» (mínimo 10 caracteres, `CONTRASENA_MIN`) y CAPTCHA invisible (Cloudflare Turnstile, D-B3). El correo se confirma con un código de 6 dígitos que llega por correo.
  2. **Identidad vinculada, obligatoria:** «Vincular Discord» o «Vincular Google» (`linkIdentity`); basta una de las dos. Una cuenta de Discord o de Google solo puede estar en una cuenta del sitio (unicidad de `auth.identities` por proveedor e id).
  3. **Perfil:**
     - «Nombre de usuario»: público, 3 a 24 caracteres `[a-z0-9_-]`, único sin distinguir mayúsculas; es el handle de §9.9 (sustituye a «Handle» y «Nombre visible» del «Perfil de Comercio», que desaparece como sección aparte).
     - «Nombre del jugador» (el personaje del juego, 1 a 32 caracteres) y «Mundo» (`Select` con `content/mundos.json`); la pareja es única sin distinguir mayúsculas.
     - «País» (`Select`, ISO 3166-1 alfa-2).
     - «Fecha de nacimiento» (se guarda la fecha; nunca se muestra).
     - Casilla «Acepto los términos y la política de privacidad», con enlace a los dos textos y la línea de no afiliación de §9.15.2. Se guarda la versión aceptada y su fecha.
- **No se pide** nombre real, documento de identidad ni domicilio.
- **Correo normalizado:** minúsculas; sin la parte `+etiqueta`; en `gmail.com` y `googlemail.com`, además, sin puntos. El correo normalizado es único entre todas las cuentas, baneadas incluidas. Los dominios de correo desechable se rechazan (tabla `blocked_email_domains`, sembrada en la migración con una lista corta escrita a mano, como mucho 20 dominios frecuentes; el propietario puede cargar una lista pública mayor con la importación que explica `docs/LANZAMIENTO.md`). Lo comprueba un Auth hook `before_user_created` (función Postgres) y no solo la interfaz.
- **Vinculaciones opcionales** (insignias en el perfil): Twitch y las «Otras plataformas» de §9.9 (D-B5). Discord y Google también cuentan como canal de contacto cuando el usuario lo activa (§9.9).
- **Teléfono:** construido y apagado (`TELEFONO_OBLIGATORIO = false`) mientras el proyecto no pueda pagar SMS. Encendido, se vuelve el paso 2b del registro y una insignia, con el flujo de §9.9 «Verificación» y Twilio Verify (D-B1).

#### 9.15.2 Comercio: requisitos, edad, avisos y consentimiento

- **Requisitos por acción** (sustituye a la tabla de §9.9; los imponen las funciones de §9.12.3, no solo la interfaz). Para publicar, editar o renovar un anuncio, contactar, confirmar, cancelar o disputar una operación, reseñar y reportar hace falta:
  - cuenta completa (§9.15.1);
  - 18 años o más según su fecha de nacimiento (`EDAD_MINIMA_COMERCIO`);
  - Discord vinculado cuya cuenta de Discord tenga al menos 60 días (`DISCORD_EDAD_MIN_DIAS`), calculado del id de Discord (snowflake: `(id >> 22) + 1420070400000` ms) al vincular;
  - el consentimiento de dinero real vigente, si la acción toca un anuncio con precio en dinero real;
  - no estar suspendido en Comercio.
  Publicar exige además ≥ 1 canal de contacto verificado y visible. Moderar exige fila en `trade_moderators`.
- **Mayoría de edad al entrar:** sin sesión, la primera visita a cualquier ruta de Comercio abre un `Dialog` «Comercio es solo para mayores de 18 años.» con «Tengo 18 años o más» y «Soy menor de edad»; la segunda lleva a `/{locale}/`. La respuesta se recuerda en `localStorage` (con `try/catch`) y no va al servidor. Con sesión decide la fecha de nacimiento y no se pregunta; una cuenta menor de 18 que entra a Comercio vuelve a `/{locale}/` con un `Notice` «Comercio es solo para mayores de 18 años.».
- **Aviso de no afiliación**, discreto (una línea en `/{locale}/comercio/` y en el paso 3 del registro): «Alliance Codex es un proyecto independiente. PokeAlliance, su servidor oficial, sus administradores y sus creadores no moderan ni garantizan este comercio. Las operaciones son entre jugadores.» / «Alliance Codex is an independent project. PokeAlliance, its official server, its administrators and its creators do not moderate or guarantee this trade. Deals are between players.»
- **Dinero real:**
  - los anuncios con precio en dinero real llevan la etiqueta «Dinero real» / «Real money» en tarjeta, fila y detalle; el detalle añade un `Note` corto de seguridad;
  - la primera vez que una cuenta publica un anuncio con dinero real o contacta a su vendedor, un `Dialog` pide el consentimiento: el sitio no procesa pagos ni garantiza operaciones; riesgo de estafa y consejos breves; en caso de reporte se usan como evidencia la IP y el identificador del navegador de las acciones de Comercio (§9.15.3); las sanciones solo afectan a Comercio. Botones «Entiendo y acepto» / «I understand and accept» y «Cancelar» / «Cancel», con el foco en «Cancelar». Se guarda en `trade_consents` (`user_id`, `version`, `accepted_at`); una versión nueva lo vuelve a pedir.

#### 9.15.3 Evidencia técnica (IP y navegador)

- Se guarda solo en acciones de Comercio (publicar, contactar, confirmar, cancelar, disputar, reseñar, reportar) y solo después del consentimiento de §9.15.2: la IP de la petición (`request.headers` de PostgREST, `x-forwarded-for`) y un identificador de navegador aleatorio (`crypto.randomUUID()` en `localStorage['alliance-codex:dispositivo']`, enviado como parámetro).
- Tabla `trade_action_evidence` (`user_id`, `action`, `ip inet`, `device_id uuid`, `created_at`); solo la leen los moderadores; nunca es pública. Se conserva 90 días (`EVIDENCIA_DIAS`), salvo la ligada a un reporte o alerta abierta; la purga es perezosa (al escribir), sin tarea programada.
- No hay bloqueo por IP: una IP compartida (redes móviles con CGNAT) no bloquea ni alerta por sí sola. La IP sirve de evidencia para la moderación y para los límites de ritmo.

#### 9.15.4 Operaciones y reseñas (sustituye partes de §9.10 y §9.12)

- **Número de operación:** `OP-` y 6 cifras (`OP-000123`), de una secuencia; se muestra en operaciones, reportes y moderación.
- **Reseñas en los dos sentidos:** con la operación `confirmada`, el comprador reseña al vendedor y el vendedor al comprador, una vez cada uno, dentro de `RESENA_DIAS`. «Puntuación»: estrellas de 1 a 5 (sustituye el 0–5), obligatoria; «Comentario» opcional (≤ 1000). **Sin capturas:** las imágenes, el bucket y la Edge Function de §9.12.5 quedan fuera por costo de almacenamiento (§15).
- **Operaciones repetidas:** la misma pareja puede operar y reseñarse muchas veces, pero como máximo 3 operaciones confirmadas por pareja (las mismas dos cuentas, en cualquier rol) y por 24 h admiten reseña (`RESENAS_PAR_DIA`); las demás cuentan como operaciones, sin reseña.
- **Reputación** (por cuenta, como vendedor y como comprador, en `trade_seller_stats` y su par de comprador), sobre las reseñas visibles:
  - `operaciones`: operaciones `confirmada`;
  - `contrapartes`: contrapartes distintas con al menos una reseña;
  - `media`: la media de las medias de cada contraparte (cada contraparte cuenta una sola vez), 1 decimal, mitad hacia arriba;
  - distribución 1–5 de todas las reseñas visibles.
  Se muestra «★ 4,8 · 50 operaciones · 5 compradores distintos» / «★ 4.8 · 50 deals · 5 distinct buyers». Orden «Reputación»: `(media × contrapartes + 3,5 × 5) / (contrapartes + 5)`, desempate por `operaciones`.
- **Sin antigüedad mínima de la cuenta del sitio** para reseñar (se puede añadir después).

#### 9.15.5 Moderación (amplía §9.11)

- El reporte de estafa admite el número de operación.
- **Alertas automáticas** (`trade_flags`), calculadas en SQL al ocurrir la acción que las dispara, solo para patrones fuertes:
  1. dos cuentas que son contrapartes de una operación confirmada o de una reseña usaron el mismo `device_id` en acciones de Comercio en los últimos 30 días;
  2. tres o más cuentas usaron el mismo `device_id` en 30 días;
  3. una cuenta recibe en 7 días ≥ 5 reseñas visibles de contrapartes cuyas cuentas del sitio tienen menos de 14 días y solo han operado con ella;
  4. la misma pareja llega al tope diario de reseñas 3 días seguidos.
  Nunca alerta solo por IP compartida ni por clientes que repiten. Cada alerta muestra su evidencia en palabras (cuentas, fechas, operaciones y el dispositivo coincidente) y las acciones «Descartar», «Ocultar reseña», «Advertir» y «Suspender en Comercio» (7 días, 30 días o indefinida).
- **Baneo = suspensión indefinida en Comercio.** La cuenta se conserva tal cual: su correo normalizado, sus identidades de Discord y Google y su nombre de jugador y mundo siguen ocupados, así que no se pueden volver a registrar. La wiki y Guild siguen funcionando para esa cuenta; sus anuncios se retiran.
- **Eliminar cuenta estando baneada:** se borra todo salvo esos identificadores, y el usuario de Auth queda bloqueado (`banned_until`), sin tabla de huellas aparte. La política de privacidad lo explica.

#### 9.15.6 Estado en línea

- Tabla `trade_presence` (`user_id` pk, `estado` enum `en_juego` | `ausente` | `desconectado`, `last_seen_at`, `last_input_at`).
- El usuario elige su estado («En el juego», «Ausente», «Desconectado») con un `ToggleGroup` en su cuenta y en Comercio.
- Con sesión y cualquier pestaña del sitio abierta y visible, la página manda un latido cada 120 s (§9.16.4) (`trade_heartbeat(activo)`, donde `activo` dice si hubo teclado o puntero desde el latido anterior); cerrar sesión pone `desconectado`.
- **Estado que ven los demás** (`trade_effective_presence`):
  - `desconectado` si el último latido tiene más de 10 minutos (`PRESENCIA_SIN_SENAL_MIN`) o no hay sesión;
  - `ausente` si eligió «En el juego» pero no hubo actividad en 6 horas (`PRESENCIA_INACTIVO_HORAS`);
  - si no, el que eligió.
- **Presentación:** un punto pequeño con la etiqueta junto al vendedor en `ListingCard`, en la fila y en el detalle («En el juego» con el color de éxito, «Ausente» con el de aviso, «Desconectado» atenuado; tokens del sistema de diseño). La lista ordena primero a quienes están «En el juego» y tiene el filtro «Solo en el juego». En la fase A los vendedores de demostración traen un estado fijo.

#### 9.15.7 Proveedores y configuración

- **Gratuitos, necesarios para lanzar:** Resend (SMTP de Auth, D-B2), Cloudflare Turnstile (D-B3), app OAuth de Discord y cliente OAuth de Google; Twitch opcional (D-B4). **De pago, opcional para después:** Twilio Verify (D-B1).
- Supabase Auth (§9.12.4): confirmación de correo activada con SMTP propio, CAPTCHA `turnstile`, vinculación manual activada, proveedores Discord, Google y Twitch, contraseña mínima 10, Auth hook `before_user_created`.
- **En local:** claves de prueba de Turnstile (siempre pasan), correos en Mailpit y las identidades de Discord y Google simuladas en las pruebas escribiendo `auth.identities` en la base local. Ninguna prueba toca el proyecto remoto.
- **Todo se construye ahora:** pantallas, diálogos, estados y funciones; cada proveedor se enciende con sus variables de entorno y sin él la interfaz no muestra su botón (S11). Al lanzar solo faltan las cuentas y claves del propietario.
- **Documentos para el propietario:** `docs/LANZAMIENTO.md` (qué cuenta crear en cada servicio, qué clave pegar en Vercel y en el panel de Supabase, y en qué orden) y borradores marcados «borrador» de términos, edad mínima y privacidad en `docs/legal/` (D-B7), que el propietario revisa.

#### 9.15.8 Parámetros nuevos (amplía §9.12.6)

| Parámetro | Valor |
|---|---|
| `EDAD_MINIMA_CUENTA` | 13 |
| `EDAD_MINIMA_COMERCIO` | 18 |
| `DISCORD_EDAD_MIN_DIAS` | 60 |
| `CONTRASENA_MIN` | 10 |
| `TELEFONO_OBLIGATORIO` | false |
| `RESENAS_PAR_DIA` | 3 |
| `EVIDENCIA_DIAS` | 90 |
| `PRESENCIA_SIN_SENAL_MIN` | 10 |
| `PRESENCIA_INACTIVO_HORAS` | 6 |

#### 9.15.9 Criterios de aceptación añadidos

Pruebas sobre la Supabase local (§14), además de CA-9.13 a CA-9.16:
1. Un segundo registro con el mismo correo normalizado (`a.b+x@gmail.com` frente a `ab@gmail.com`) o con un dominio desechable falla en el hook.
2. Una identidad de Discord o Google no se vincula a una segunda cuenta.
3. Sin los tres pasos, ninguna función de cuenta ni de Comercio responde; con 15 años, las de Comercio fallan con `42501`; con Discord de 59 días, también.
4. Sin consentimiento vigente, contactar o publicar con dinero real falla; tras aceptarlo, la acción guarda su evidencia (IP y `device_id`) y la de otra cuenta no es legible salvo para moderadores.
5. Comprador y vendedor se reseñan una vez por operación, de 1 a 5; la cuarta operación del día de la misma pareja no admite reseña.
6. La media cuenta a cada contraparte una vez: 40 reseñas de 5 de una contraparte y 1 reseña de 1 de otra dan 3,0 con 41 reseñas y 2 contrapartes.
7. Las cuatro alertas se disparan con sus patrones y no con una IP compartida entre cuentas sin relación.
8. Un baneo deja ocupados el correo normalizado, las identidades y el nombre de jugador; eliminar la cuenta baneada no los libera.
9. El estado efectivo pasa a «Desconectado» a los 10 minutos sin latido y a «Ausente» a las 6 horas sin actividad, con el reloj inyectado.

### 9.16 Cuenta en la cabecera y «Mi perfil» (decisión del propietario, 2026-09-23)

El propietario revisó la vista previa: no había forma visible de saber si la sesión estaba iniciada ni de entrar desde cualquier página. Esta sección añade la entrada de cuenta a la cabecera de todo el sitio y la página «Mi perfil». Amplía §5.6 (cabecera) y §9.9 (cuenta); gana sobre ellas si chocan.

#### 9.16.1 Entrada de cuenta en la cabecera

- **Solo con cuentas:** existe cuando el build tiene `PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY`. Sin ellas la cabecera no dibuja nada de cuenta (sin controles falsos).
- **Posición:** a la derecha de la cabecera, antes del selector de idioma desde 1280 y antes del separador del grupo compacto por debajo; siempre visible, también en móvil (el menú móvil no la sustituye).
- **Estados**, con la misma geometría para que nada se mueva (CLS 0):
  1. **Sin saber aún:** un hueco del tamaño final, sin texto.
  2. **Sin sesión:** `Button` secundario «Iniciar sesión» / «Sign in» hacia `/{l}/cuenta/`. Por debajo de 768 es un botón de icono con el sprite del entrenador y la misma etiqueta accesible.
  3. **Con sesión:** chip de cuenta con avatar de 28 px (el de la identidad de Discord o Google vinculada; si no hay, la inicial del nombre de usuario sobre un disco con color del sistema), el nombre de usuario desde 768 y, con `COMERCIO_PUBLICO`, el punto de estado en la esquina del avatar con el color de §9.15.6 y su etiqueta como nombre accesible («En el juego», «Ausente», «Desconectado»). El estado se ve sin abrir el menú.
  4. **Registro sin terminar** (faltan los pasos 2 o 3 de §9.15.1): el chip lleva una marca «!» y la primera opción del menú es «Completar registro».

#### 9.16.2 Menú de cuenta

Patrón de botón de menú: se abre con clic, Intro, Espacio o flecha abajo; Esc lo cierra y devuelve el foco; un clic fuera lo cierra. Contenido, en este orden:

1. **Cabecera:** avatar, nombre de usuario, «{jugador} · {mundo}» y la etiqueta del estado.
2. **«Estado»** (solo con `COMERCIO_PUBLICO`): tres `menuitemradio` «En el juego», «Ausente», «Desconectado». Elegir uno cambia el estado de §9.15.6 al momento y el punto del chip lo refleja.
3. **Enlaces:** «Mi perfil» (`/{l}/cuenta/perfil/`; sin `COMERCIO_PUBLICO`, la sección «Perfil», `/{l}/cuenta/#perfil`), «Mis anuncios» (`/{l}/cuenta/anuncios/`), «Mis operaciones» (`/{l}/cuenta/operaciones/`), «Mis guilds» (`/{l}/cuenta/#guilds`), «Ajustes de la cuenta» (`/{l}/cuenta/`) y «Moderación» (`/{l}/comercio/moderacion/`, solo moderadores). Los de Comercio solo con `COMERCIO_PUBLICO`. Todos abren la misma interfaz de cuenta (dueño, 2026-09-25): «Crear anuncio» está junto a la búsqueda de Comercio, no en el menú.
4. Separador y **«Cerrar sesión»**, que pone `desconectado` (§9.15.6), cierra la sesión y deja la página en el estado «Sin sesión».

#### 9.16.3 Las páginas de Comercio de la cuenta

Decisión del dueño (2026-09-25): «Mi perfil», «Mis anuncios» y «Mis operaciones» viven en la misma interfaz que «Ajustes de la cuenta» (Cuenta-panel.dc.html): la tarjeta de cabecera y la navegación por secciones, donde cada una es una entrada del grupo Comercio. Son páginas propias, prerenderizadas con una isla (`AccountPage.tsx`), que existen con la configuración pública de Supabase y `COMERCIO_PUBLICO`; la entrada de la navegación solo aparece para una cuenta de 18 años o más (§9.15.2), como «Estado en línea». Sin sesión: la línea de la página («Inicia sesión para ver tu perfil.») y «Iniciar sesión». Con registro sin terminar: «Completar registro». Menor de 18 según la fecha de nacimiento guardada: «Comercio es solo para mayores de 18 años.» y el enlace a la cuenta. Migas: «Inicio › Cuenta › {página}»; el h1 es solo para lectores de pantalla.

- **Navegación:** Cuenta (Resumen, Perfil, Personajes, Conexiones, Seguridad), Comercio (Reputación, Anuncios, Operaciones, Canales de contacto, Estado en línea), Guild (Guilds) y aparte «Eliminar cuenta». En `/{l}/cuenta/` las secciones son fragmentos (`#perfil`); desde una página, `/{l}/cuenta/#perfil`. En el teléfono la página ocupa la pantalla bajo «‹ Cuenta» y el índice de `/{l}/cuenta/` tiene una fila por página.
- **Tarjeta:** el botón es «Ver perfil público» (`/{l}/comercio/vendedor/{usuario}/`), con Comercio y 18 años o más; «Mi perfil» es la entrada «Reputación» de la navegación.

1. **«Mi perfil»** (`/{l}/cuenta/perfil/`, entrada «Reputación»):
   - **Reputación:** dos cajas, «Como vendedor» y «Como comprador», cada una con «★ 4,8 · 50 operaciones · 5 compradores distintos» (o «vendedores distintos») según §9.15.4 y las barras de 5 a 1 estrellas; sin reseñas, «Sin reseñas todavía.»
   - **Reseñas:** «Recibidas» / «Hechas» (`?resenas=hechas`), 10 por página (`?pagina=`): estrellas, la contraparte (enlazada a su perfil de vendedor), el papel («como vendedor» / «como comprador»), el número de operación, la fecha y el comentario; «Oculta por moderación» cuando corresponde y «Editar» mientras siga abierto el plazo de 30 días (§9.15.4), que lleva a «Mis operaciones».
   - Un enlace antiguo con `?pestana=` sigue a la página que tiene esa pestaña ahora.
2. **«Mis anuncios»** (`/{l}/cuenta/anuncios/`): «Crear anuncio» y los filtros de estado con su cuenta («Todos», «Publicados», «Reservados», «Expirados», «Completados», «Retirados»; `?estado=`), y todos los anuncios propios, del más reciente al más antiguo, con las tarjetas de §9.5.8 por tipo de activo. Bajo cada tarjeta, su estado cuando la tarjeta no lo dice, «Editar» mientras esté publicado o reservado y las acciones que §9.7.8 permite («Renovar», «Reservar» / «Quitar reserva», «Marcar completado», «Retirar»). «Marcar completado» y «Retirar» no se deshacen: piden confirmación (diálogo de alerta con el foco en «Volver»). Es el historial de lo publicado: el sitio no sabe si algo se vendió fuera de una operación confirmada.
3. **«Mis operaciones»** (`/{l}/cuenta/operaciones/`, §9.10): «Compras» / «Ventas», la tabla y los diálogos de cada acción y de la reseña. `/{l}/comercio/operaciones/` responde un 302 hacia ella.

**Editar la información propia** (sección «Perfil» de `/{l}/cuenta/`): el país, el nombre de jugador y el mundo (con la comprobación de unicidad de §9.15.1) y qué canales se muestran en los anuncios (§9.9). El nombre de usuario no cambia después del primer anuncio y la fecha de nacimiento no cambia una vez guardada.

#### 9.16.4 Rendimiento y datos

- La entrada de cuenta no carga supabase-js al abrir una página: lee la sesión que supabase-js guarda en `localStorage` y una caché pequeña del perfil (`alliance-codex:cuenta:v1`: usuario, jugador, mundo, avatar, estado, moderador, registro completo), con cada lectura y escritura en `try/catch`. Sin almacenamiento, se ve «Iniciar sesión».
- El cliente de Supabase se carga bajo demanda (`import()`, D-025) al abrir el menú, al cambiar el estado o al cerrar sesión, y entonces refresca la caché. Si la sesión ya no es válida, el chip pasa a «Sin sesión».
- El evento `storage` sincroniza el chip entre pestañas.
- El latido de §9.15.6 tampoco carga supabase-js en cada página: llama a la función por HTTP con el token de la sesión guardada y solo carga el cliente para renovar un token vencido.
- **Tráfico de salida de Supabase (egress, 5 GB al mes en el plan gratuito):** el latido sale cada 120 s y solo con la pestaña visible (`visibilitychange`), pide `Prefer: return=minimal` y la función no devuelve cuerpo; «desconectado» sigue siendo 10 minutos sin latido. Las páginas públicas de Comercio que se renderizan en el servidor (lista, detalle y perfil del vendedor) responden con `Cache-Control: public, s-maxage=30, stale-while-revalidate=300` y no llevan nada personal en su HTML (lo personal lo pide la isla del navegador), así que la CDN de Vercel consulta Supabase como mucho una vez cada 30 s por dirección. Estimación con 3.000 cuentas activas: menos de 2 GB al mes.
- Presupuesto: el script de la entrada y del latido suma ≤ 4 KB gzip en toda página (fila nueva de §13.6); «Mi perfil» usa la fila de Comercio (140 KB).

#### 9.16.5 Criterios de aceptación

1. Sin las variables de Supabase, ninguna página tiene entrada de cuenta; con ellas, toda página la tiene, en escritorio y en móvil.
2. Sin sesión se ve «Iniciar sesión» y lleva a `/{l}/cuenta/`; al iniciar sesión, sin recargar otras pestañas, el chip muestra el usuario y el punto de estado.
3. Cambiar el estado desde el menú actualiza el punto al momento y lo que ven los demás en Comercio (§9.15.6).
4. «Cerrar sesión» desde el menú deja el chip en «Iniciar sesión» y el estado en «Desconectado».
5. «Mi perfil» lista los anuncios propios de todos los estados, las reseñas recibidas y las hechas, y la reputación como vendedor y como comprador.
6. El JS inicial de las páginas de contenido sigue dentro de 90 KB y la entrada no mueve nada al pintarse (CLS 0).

---

## 10. Guild

Fuentes: `Lienzo:Guild`, R14, A10, A12, A14, Q2, D-004, D-005, `docs/GUILD_SYSTEM_RESEARCH.md` y `docs/PHASE_5_GUILD_RANKING_REPORT.md`.

### 10.1 Punto de partida y alcance

`/{locale}/herramientas/guild/` (`src/pages/[locale]/herramientas/guild.astro`) monta `GuildRankingTool` (`src/components/tools/GuildRankingTool.tsx`, 2217 líneas). Tiene:
- pestañas Clasificación, Actividad e Historial (`:1423-1442`);
- filtros por banda de meta (`:1446-1464`);
- hojas de Metas, Cuenta y Miembro;
- exportación a WhatsApp, Discord y PNG (`:1382-1396`).

v2 conserva el motor de cálculo y reescribe la interfaz como `Lienzo:Guild`: analítica de administración por día, semana, tendencia e inactividad.

### 10.2 Datos que existen hoy

| Dato | Dónde |
|---|---|
| **Export del cliente** (Ctrl+J, Q2): `exportedAt`, `guild` y, por miembro, `name`, `rank`, `level`, `dailiesCompleted`, `contribution`, `status`, `lastLogin` | `GuildMemberExport` y `GuildExportPayload` en `src/lib/tools/guild-ranking.ts:59-73`; validación en `:205-252`; campos observados en `docs/GUILD_SYSTEM_RESEARCH.md:9-13` |
| **Acumulados:** `dailiesCompleted` y `contribution` son acumulados de la semana. El delta de un corte se calcula contra el corte anterior de la misma semana; el primero de la semana es la base | `src/lib/tools/guild-daily-history.ts:251-265`, `:422-426` |
| **Semana:** de lunes a domingo, con Server Save a las 00:00 de `America/Sao_Paulo` | `getGuildWeekContext`, `guild-ranking.ts:274-296` |
| **Un corte por fecha:** una segunda importación del mismo día reemplaza a la primera | `replaceGuildDailySnapshot`, `guild-daily-history.ts:224-232` |
| **Puntos** = dailies × valor por nivel + contribución, con tramos 0–149: 150, 150–349: 300 y 350+: 600 (D-005) | `GUILD_DAILY_VALUE_TIERS`, `guild-ranking.ts:18-28`; suma en `guild-daily-history.ts:511-512` |
| **Reparto por dificultad:** estimado cuando un miembro cambia de tramo; admite corrección manual | `src/lib/tools/guild-difficulty.ts`; editor en `GuildRankingTool.tsx:2140` |
| **Metas por defecto:** normal, 2.950 puntos por semana y 1 daily por día; premium, 5.900 por semana | `DEFAULT_GUILD_PACING`, `guild-ranking.ts:46-57` |
| **Altas, bajas y regresos:** las dailies cuentan desde el día siguiente y la contribución desde dos días después | `guild-daily-history.ts:398-416`, `:453-474` |
| **Niveles ganados** | `levelDelta`, `guild-daily-history.ts:289-291` |
| **Almacenamiento local:** hasta 120 cortes en `localStorage` (`alliance-codex:guild-workspace:v1`) | `GuildRankingTool.tsx:97-98`, `:611-703` |
| **Supabase:** `guilds`, `guild_memberships` (rol `owner`, `officer` o `member`), `guild_daily_exports`, `guild_daily_member_totals` y la vista `guild_daily_member_deltas` | `supabase/migrations/202609090004_phase2_content_guild_rls.sql:79-100`, `202609090001_phase2_extensions_enums.sql:81`, `202609100001_phase5_guild_daily_history.sql:5-31`, `:54-76`, `:80` |
| **Permisos:** solo `owner` y `officer` importan; los miembros del sitio leen | `202609100001_phase5_guild_daily_history.sql:197`, `:314-354` |
| **Cliente:** `listUserGuilds`, `listGuildDailySnapshots` (carga todos los cortes), `createUserGuild`, `replaceUserGuildDailyExport` | `src/lib/supabase/guilds.ts:32-44`, `:46-120`, `:122-135`, `:140-193` |

**Qué no existe:**
- el mundo real de la guild: la creación fija `worldKey: 'pokealliance'` (`src/components/tools/GuildPersistencePanel.tsx:261`);
- invitaciones (`GUILD_SYSTEM_RESEARCH.md:55`);
- metas guardadas por guild: hoy viven en el navegador;
- borrado de un corte;
- agregados por periodo, serie diaria, tendencia por miembro e inactividad.

### 10.3 Del tablero a los datos

| Elemento de `Lienzo:Guild` | Cálculo | Estado |
|---|---|---|
| Cabecera: Mundo, Miembros, Último export, Semana, Acceso | §10.5 | Mundo y Acceso necesitan §10.13; el resto se deriva |
| KPI por periodo con comparación | §10.6 | Se deriva de los deltas |
| Serie de 14 días con meta diaria | §10.7 | Se deriva; los días sin corte se marcan |
| Totales por semana y comparación en el mismo punto del ciclo | §10.8 | Se deriva |
| Miembros: Hoy, 7 días, 30 días, tendencia, última actividad, inactivos | §10.9 | Se deriva |
| Exportar PNG y CSV | §10.12 | PNG se reescribe; CSV es nuevo |

Todo cálculo nuevo vive en `src/lib/tools/guild-analytics.ts`, con funciones puras sobre `GuildDailyHistory`, las metas y `hoy: Temporal.PlainDate`, inyectable en pruebas. La interfaz no calcula. La isla de Guild es la única que carga `@js-temporal/polyfill` en el cliente, dentro de su presupuesto (§3.13, §13.6).

La contribución (`contribution`) se muestra como entero agrupado sin sprite mientras Q15 no diga que es un importe de Pokédólares; si lo es, cada importe de contribución de §10.6–§10.12 pasa a `PokedolaresAmount` (R5).

### 10.4 Modos y acceso

- **Modo local**, sin sesión:
  - los cortes viven en `localStorage` con la clave actual;
  - el límite de 120 cortes cubre 30 días más 5 semanas;
  - la cabecera dice «Acceso: solo este navegador».
- **Modo cuenta** (sesión con el flujo de §9.9; Guild no pide teléfono):
  - los cortes salen de Supabase;
  - si la cuenta pertenece a más de una guild, un `Select` «Guild» aparece a la derecha del título;
  - la cabecera dice «Acceso: propietario y N oficiales», contados con `guild_access_summary` (§10.13).
  - El tablero dice «Leader y Vice-Leader», pero los rangos del juego no se pueden comprobar para una cuenta del sitio. Por eso se muestran los roles del sitio (X9).
- **Al iniciar sesión con cortes locales:** `Notice` «Hay N cortes en este navegador.», con la acción «Subir a {guild}». Sube cada corte con `replace_guild_daily_export` y conserva el que ya exista en la guild para la misma fecha, salvo que el digest difiera. En ese caso reemplaza y lo dice en el aviso.
- **`/{locale}/cuenta/`, `Section` «Guilds»:**
  - lista de guilds con su rol;
  - «Crear guild», con nombre y «Mundo» (`Select` con `content/mundos.json`, §8.1);
  - por guild, si la cuenta es propietaria:
    - «Invitar oficial» o «Invitar miembro», que genera un enlace de un solo uso válido 7 días con el botón «Copiar enlace»;
    - la lista de cuentas con rol y «Quitar». «Quitar» pide confirmación en un `Dialog`: título «¿Quitar a {cuenta} de {guild}?» / «Remove {account} from {guild}?», texto «Pierde el acceso a esta guild. Los cortes no cambian.» / «They lose access to this guild. Snapshots don't change.», botones «Quitar» / «Remove» y «Cancelar» / «Cancel»;
    - «Eliminar guild», con confirmación en un `Dialog`: título «¿Eliminar {guild}?» / «Delete {guild}?», texto «Se borran la guild, sus cortes, sus metas y el acceso de todas sus cuentas. No se puede deshacer.» / «This deletes the guild, its snapshots, its goals and every account's access. This can't be undone.», botones «Eliminar guild» / «Delete guild» y «Cancelar» / «Cancel».
  - En los tres diálogos de confirmación (estos dos y «Eliminar cuenta», §9.9) el foco inicial va a «Cancelar», y un error de la operación se muestra dentro del diálogo con `mapSupabaseError` (§12.14.1) sin cerrarlo.
- **Roles:**
  - `officer` importa y edita metas;
  - `member` solo lee;
  - `owner` gestiona el acceso.

### 10.5 Página

Columna de 944 sin rail. De arriba abajo:

1. `Breadcrumb` «Herramientas › Guild › {nombre de la guild}».
   - El HTML prerenderizado lleva «Herramientas › Guild» y el h1 «Guild».
   - Con un espacio de trabajo cargado, la isla añade la guild como miga actual y cambia el h1 por su nombre: el `guild` del export en modo local, `display_name` en modo cuenta.
2. `PageTitle` {nombre}.
3. **Fila de cabecera:**
   - Datos (14/32, etiqueta en 700):
     - «Mundo: {mundo}», solo en modo cuenta;
     - «Miembros: {N del último corte}»;
     - «Último export: {fecha, hora} (hora de Brasilia)», que es `exportedAt` convertido a `America/Sao_Paulo` (A12);
     - «Semana: {lun} a {dom}, día {k} de 7», la semana de hoy;
     - «Acceso: …» (§10.4).
   - A la derecha, apilados:
     - `Button` «Importar export» (§10.10);
     - debajo, en 12/16 `helper`, «Exporta desde la ventana de guild del juego (Ctrl+J).» (Q2);
     - junto a «Importar export», `Button` «Metas» (§10.11). No está en el tablero; se añade porque A14 pide que §10 decida dónde se editan las metas (X10).
4. `Section` «Resumen» (§10.6).
5. `Section` «Por día» (§10.7).
6. `Section` «Por semana» (§10.8).
7. `Section` «Miembros» (§10.9).

**Sin cortes:** en lugar de 3 a 7, `EmptyState` «Importa un export de guild para ver el análisis.», con la acción «Importar», y debajo la línea de Ctrl+J (`DS:guias/50`).

**HTML prerenderizado, carga y error.** La página no sabe en el build si hay sesión ni cortes, así que su HTML solo lleva las migas, el h1 «Guild» y la región de la isla vacía con `aria-busy="true"`; ni el `EmptyState` ni la cabecera de datos. Al hidratar, la isla lee `localStorage` y la sesión (`getSession`, local):
- **Modo local**, o sesión sin guilds: pinta los cortes locales o el estado «Sin cortes» sin espera.
- **Modo cuenta, cargando:** mientras `listGuildDailySnapshots` no responde, la región muestra una sola línea `role="status"`: «Cargando la guild…» / «Loading guild…». El estado «Sin cortes» nunca aparece antes de la respuesta.
- **Modo cuenta, error:** `Notice` con el texto de `mapSupabaseError` (§12.14.1) y el botón «Reintentar» / «Retry», que repite la petición. Si hay cortes locales, debajo sigue el análisis local con la cabecera «Acceso: solo este navegador».
- Cuando la región pasa a tener contenido, quita `aria-busy`.

### 10.6 Resumen

**Definiciones:**

- **D:** fecha actual del Server Save (reloj del cliente en `America/Sao_Paulo`).
- **Corte `s`:** tiene fecha `o(s)` e intervalo `I(s)`:
  - `[o(anterior) + 1, o(s)]` si hay un corte anterior en la misma semana;
  - `[lunes, o(s)]` si es la base de la semana.
- **Delta de un miembro en un corte:** dailies `Δd`, contribución `Δc` y puntos `P` = puntos de dailies + `Δc` (motor actual).
- **Un corte pertenece a un periodo** si `o(s)` cae en él.

**Periodos** (`PeriodFilter`):

| Periodo | Rango |
|---|---|
| Hoy | `[D, D]` |
| 7 días | `[D−6, D]`; por defecto |
| 30 días | `[D−29, D]` |
| Rango | «Desde» y «Hasta», en dd/mm/aaaa. Máximo 366 días; «Hasta» ≤ D; «Desde» ≤ «Hasta». Un rango no válido marca el campo y conserva el periodo anterior |

El texto del periodo, a la derecha del filtro, sigue `DS:PeriodFilter`: «12/09 a 18/09»; «Hoy, 18/09 hasta las 14:32», con la hora del último corte de D; «01/09 a 18/09, 18 días».

**KPI** (`CardGrid family="kpi"`, 4 `KpiCard`):

| KPI | Valor | «de» | Comparación |
|---|---|---|---|
| Miembros con actividad | Miembros del último corte del periodo con Σ(`Δd` + `Δc`) > 0 en el periodo | Miembros del último corte del periodo | «{k} sin actividad desde hace {X} días o más», con X el umbral de §10.11 y k los inactivos de §10.9 |
| Dailies | Σ `Δd` | Σ por miembro de (días elegibles del periodo con corte × meta diaria de dailies). Se omite si esa meta está vacía | Periodo anterior de igual largo |
| Contribución | Σ `Δc` | — | Igual |
| Puntos | Σ `P` | — | Igual |

- **Días elegibles:** los del motor (`eligibleDailyDays`).
- **Comparación:**
  - Formato: «{7 días anteriores | 30 días anteriores | Ayer | N días anteriores}: {valor} ({±p%})».
  - Solo se muestra si los dos periodos tienen corte en todos sus días.
  - Si no, «{etiqueta}: {c} de {n} días con export», sin porcentaje.
  - Con valor anterior 0, sin porcentaje.
  - La variación no lleva color (`DS:KpiCard`).
- **Periodo sin cortes:** las cuatro tarjetas se sustituyen por `EmptyState` «Sin exports en este periodo. Último export: {fecha}.»

### 10.7 Por día

- `ToggleGroup` «Métrica»: «Puntos» (por defecto), «Dailies», «Contribución».
- `BarChart` de los 14 días `[D−13, D]`:
  - **Día con corte:** barra con el valor del corte.
  - **Día sin corte:** columna sin barra y, bajo la fecha, «sin export» en 12/16 `text-tertiary`. Nunca una barra de 0.
  - **Corte que cubre más de un día** (`|I(s)| > 1`): su barra está en `o(s)` y su tooltip añade «Desde:» con la fecha inicial del intervalo, o «Desde: lunes {dd/mm}» si es la base de la semana.
  - **Día D con corte:** barra al 45% y «en curso» bajo la fecha.
  - **Tooltip de 200:** título «{Día de la semana} {dd/mm}», con «, en curso» en D; filas «Puntos:», «Dailies:», «Contribución:», «Con actividad: {a} de {n}».
  - **Bandas:** «Semana del {dd/mm}» y una línea vertical en cada lunes.
  - **Tabla oculta:** los mismos datos, con caption «Actividad diaria de los últimos 14 días».
- **Escala:** `niceTicks(max(valor máximo, meta))`:
  - paso = el menor de {1, 2, 2,5, 5} × 10^k, con 2,5 solo si k ≥ 1 y el paso entero, tal que floor(tope / paso) + 1 ≤ 6;
  - tope del eje = (floor(tope / paso) + 1) × paso.
- **Meta diaria** (línea discontinua con leyenda «Meta diaria: N»):
  - Puntos: Σ por miembro del último corte de (meta semanal de puntos / 7), redondeado al entero;
  - Dailies: miembros × meta diaria de dailies;
  - Contribución: Σ de metas de contribución si existen; si no, sin línea.
  - Solo cuentan las metas normales, no las premium.
- **Línea de fórmula**, en 12/16 `helper` (`#a1a1aa`; el token `helper` del DS es «fórmula de puntos», y así la pinta `Lienzo:Guild`): «Puntos = {dailies} × valor por nivel (nivel 1 a 149: 150; 150 a 349: 300; 350 o más: 600) + contribución. Meta semanal: {meta} puntos por miembro. El día cambia con el Server Save de las 00:00 (hora de Brasilia).»
  - Los tramos y los valores salen de los ajustes (§10.11). El tramo que empieza en 0 se escribe desde 1. «Meta semanal…» se omite si no hay meta semanal de puntos.
  - «dailies» es un `NestedEntity` con el tooltip del sistema «Dailies de guild» (`content/sistemas/`, §8.4), con filas de su registro (tamaño `size-tt-wide`). Si el registro no existe, es texto. Las filas de ese tooltip en el tablero son muestras (X4); `docs/CONTENT_PLAN.md:705` registra el conflicto C-016 sobre ese sistema.

### 10.8 Por semana

- **Comparación**, arriba:
  - «De lunes a {día D−1}, esta semana suma **{p} puntos**; la anterior sumaba {q} en los mismos días ({±r%}). Dailies: {a} frente a {b}. Contribución: {c} frente a {d}.»
  - Solo existe si D no es lunes y las dos semanas tienen corte en cada día de lunes a D−1.
- **`DataTable`**, caption «Totales por semana, de lunes a domingo». Las 5 semanas que terminan en la semana de D, de la más antigua a la actual:

| Columna | Valor |
|---|---|
| Semana | «{lun} a {dom}». En la actual, línea secundaria «en curso, día {k} de 7». En una semana con cortes faltantes, «{c} de 7 días con export» |
| Puntos, Dailies, Contribución | Σ de la semana |
| Con actividad | «{a} de {n}» (n = miembros del último corte de la semana) |
| Meta semanal | Semana cerrada: «{m} de {n}», miembros con puntos ≥ meta semanal prorrateada por días elegibles (el `goalPacing` actual). Semana actual: «{m} en ritmo», con puntos ≥ meta × días elegibles transcurridos / 7. «—» sin meta semanal de puntos |
| Niveles ganados | «+{Σ max(0, levelDelta)}» |

Semana sin cortes: fila con «—» en cada cifra.

### 10.9 Miembros

- **Barra de herramientas:**
  - `TextField variant="filter"` «Buscar miembro», de 280, que filtra por nombre normalizado;
  - `ToggleGroup` «Filtrar miembros»: «Todos ({n})» e «Inactivos ({k})»;
  - a la derecha, `Button` «Exportar PNG» y `Button` «Exportar CSV» (§10.12).
- **`DataTable`**, caption «Puntos por miembro» y «, solo inactivos» con el filtro. Filas: los miembros del último corte con fecha ≤ D. 10 por página, con `Pagination` y resumen «{a} a {b} de {n} miembros».

| Columna | Ancho a 944 | Valor | Orden |
|---|---|---|---|
| Miembro | 128 | Botón con el nombre que abre el diálogo del miembro. En el tablero es texto; es botón para conservar la evaluación y el reparto de dificultad (X10) | Ascendente |
| Rango | 124 | Rango del juego sin artículo: «the Leader» → «Leader», «a Vice-Leader» → «Vice-Leader», «a Member» → «Member», iguales en los dos idiomas (E13). Otros valores, tal cual. Sustituye a `formatGuildRank`, que hoy devuelve portugués (`guild-ranking.ts:576-586`) | — |
| Nivel | 88 | `level` del último corte | Descendente |
| Hoy | 80 | `P` del corte de D, o «—» sin corte de D | Descendente |
| 7 días | 92 | Σ `P` en `[D−6, D]` | Descendente, por defecto |
| 30 días | 100 | Σ `P` en `[D−29, D]` | Descendente |
| Tendencia | 170 | `Sparkline` de los 14 valores diarios de `P` (días sin corte: marca de 1 px) con la variación «(Σ7 − Σ7 anteriores) / Σ7 anteriores». «—» si el anterior es 0 o le faltan cortes | — |
| Última actividad | 160 | Ver abajo | Más inactivos primero |

- **Última actividad:**
  - Es el corte más reciente con `Δd` + `Δc` > 0:
    - «hoy», «ayer» o «hace N días ({dd/mm})»;
    - si ese corte cubre más de un día, «entre {dd/mm} y {dd/mm}».
  - Sin actividad en los cortes cargados: «sin actividad registrada».
  - **Inactivo:** han pasado ≥ X días (umbral de §10.11, 3 por defecto) desde esa actividad o, sin actividad, desde que el miembro apareció por primera vez.
    - La fila lleva `tone="inactive"`, el nombre en 700 y el chip «Inactivo».
    - Un miembro que apareció hace menos de X días no es inactivo.
- **Filtro «Inactivos»:** muestra solo los inactivos y el texto de ayuda «Sin dailies ni contribución desde hace {X} días o más.».
- **Diálogo del miembro** (`Dialog`, §7.2.8; título = nombre):
  - `FactList` «Rango», «Nivel» y «Último acceso» (`lastLogin` del último corte);
  - «Semana»: «{p} de {meta} puntos», con el estado «Premium», «En meta», «Bajo meta» o «Sin meta» de `getGuildMemberBand(member, ranking, goalPacing)` (`guild-ranking.ts:541-563`);
  - `DataTable` «Últimos 14 días» con Día, Dailies, Contribución y Puntos, con «sin export» en los días sin corte;
  - «Reparto de dailies»: solo si el reparto de la semana es estimado. Es el editor actual (`GuildRankingTool.tsx:2140`), con «Guardar desglose» y «Volver a automático».

### 10.10 Importar y cortes

- **`Dialog` «Importar export»:**
  - `input type="file"` múltiple (`.json`) y `Textarea` «O pega el JSON»;
  - `Button` «Importar»;
  - en modo local escribe en `localStorage`; en modo cuenta, en Supabase (solo `owner` y `officer`; un `member` no ve el botón).
- **Resultado:** `Notice` con «Importados: 17/09, 18/09.» y, si hubo reemplazos, «Reemplazado: 18/09.»
- **Errores por archivo:** «{archivo}: {mensaje}», con un mensaje por cada código de `ParseErrorCode` (`guild-ranking.ts:160-166`) y por la falta de `exportedAt` (`guilds.ts:149-154`). El nombre del archivo solo aparece en el mensaje y nunca se guarda (R6).
- **`Section` «Cortes»** dentro del diálogo: `DataTable` con Fecha, Miembros y el botón «Eliminar».
  - Pide confirmación: «¿Eliminar el corte del {dd/mm}? Se recalculan los deltas de esa semana.», con «Eliminar» y «Cancelar».
  - En modo cuenta llama a `delete_guild_daily_export` (§10.13).
- No hay selector de zona horaria (A12). Un `exportedAt` sin zona se interpreta en `America/Sao_Paulo`.

### 10.11 Metas y cálculo

`Dialog` «Metas y cálculo»:

- **«Metas normales» y «Metas premium»:** filas Puntos, Dailies y Contribución; columnas «Por día» y «Por semana». Campos numéricos; vacío significa que no se evalúa. Es la matriz de D-005.
- **«Puntos por daily»:** los tres tramos de `GUILD_DAILY_VALUE_TIERS` con los puntos editables.
- **«Cambio de nivel durante la semana»:** `Select` con «Estimar con la dificultad actual», «Estimar con la dificultad anterior» y «Marcar para revisar».
- **«Días sin actividad para marcar inactivo»:** `NumberField` de 1 a 30, con 3 por defecto. Es nuevo.
- **Pie (A14):**
  - «Guardar», desactivado sin cambios, persiste todo;
  - «Cancelar» revierte todo y cierra;
  - con errores, «1 campo no válido» / «{n} campos no válidos» y «Guardar» desactivado.
- **Dónde se guarda:** en modo local, en `localStorage` (clave actual); en modo cuenta, en `guild_settings` (solo `owner` y `officer`).

### 10.12 Exportar

- **CSV:**
  - las filas del filtro y el orden actuales, todas las páginas;
  - UTF-8 con BOM, separador coma, CRLF, comillas RFC 4180;
  - cabecera `es`: `Miembro,Rango,Nivel,Hoy,7 días,30 días,Variación 7 días (%),Última actividad,Inactivo`; cabecera `en` equivalente;
  - cifras sin agrupar; variación con punto decimal y signo (`-13.3`); fecha ISO (`2026-09-18`); `sí`/`no` (`yes`/`no` en `en`); vacío si se desconoce;
  - nombre: `guild-{slug}-{AAAA-MM-DD}.csv`.
- **PNG:**
  - la tabla de miembros del filtro y el orden actuales, todas las filas;
  - encabezado con la guild, «Semana {lun} a {dom}» y «Último export: …»;
  - 1200 de ancho, colores de `tokens.json` y Verdana;
  - `guild-ranking-image.ts` se reescribe, y la banda usa el mismo `goalPacing` que la interfaz (hoy no lo pasa: `guild-ranking-image.ts:250`);
  - nombre: `guild-{slug}-{AAAA-MM-DD}.png`.

### 10.13 Supabase

Migración local `supabase/migrations/<AAAAMMDDhhmmss>_guild_admin.sql`. Nunca se aplica en remoto.

| Cambio | Detalle |
|---|---|
| **`guild_settings`** | Columnas: `guild_id` pk → `guilds`, `goals` jsonb, `difficulty_tiers` jsonb, `transition_policy` text, `inactivity_days smallint` (1–30, 3 por defecto), `updated_by`, `updated_at`. Select para miembros; escritura por RPC `set_guild_settings` (`owner` y `officer`) |
| **`guild_invitations`** | Columnas: `invitation_id`, `guild_id`, `role` (`officer` o `member`), `token_hash`, `expires_at`, `created_by`, `accepted_by`, `accepted_at`. RPC `create_guild_invitation` (`owner`; devuelve el token una vez), `accept_guild_invitation(token)` y `revoke_guild_invitation` |
| **Membresías** | RPC `set_guild_member_role` y `remove_guild_member` (`owner`). RPC `guild_access_summary(guild_id)`: devuelve el conteo por rol, porque hoy `guild_memberships` solo deja leer la fila propia (`202609100001_phase5_guild_daily_history.sql:326-327`) |
| **Mundo** | `create_guild` recibe el id del mundo de `content/mundos.json` (§8.1). La interfaz deja de fijar `'pokealliance'` (`GuildPersistencePanel.tsx:261`) |
| **Borrado** | RPC `delete_guild_daily_export(guild_id, observation_date)` (`owner` y `officer`). Borrar la guild (`owner`) usa las cascadas que ya existen (`202609100001_phase5_guild_daily_history.sql:7`) |
| **Carga** | `listGuildDailySnapshots` recibe `{ from }` y trae los cortes desde el lunes de la semana de D−34. Rango pide más al elegir fechas anteriores |
| **Reintento heredado** | `guilds.ts:179-188` se borra cuando el propietario aplique `20260918220000_remove_provenance.sql` |

Pruebas RLS (§14): un `member` no importa, no borra ni edita metas; un `officer` no invita ni borra la guild; una cuenta ajena no lee nada.

### 10.14 Qué sale del código

| Pieza | Motivo |
|---|---|
| Pestañas Clasificación, Actividad e Historial (`GuildRankingTool.tsx:1423-1442`) | Las sustituyen las secciones del tablero |
| Filtros En meta, Por debajo y Sin meta (`:1446-1464`) | El tablero filtra por inactividad; el estado de meta queda en el diálogo del miembro y en «Meta semanal» |
| «Ver JSON» (`:1727-1737`) | A10 |
| Copias para WhatsApp y Discord (`:1388-1393`), junto con `buildGuildWhatsAppText`, `buildGuildDiscordText` (`guild-ranking.ts:750`, `:804`) y sus pruebas | A10: las salidas son PNG y CSV |
| Selectores de zona horaria | A12 |
| Vista histórica y «Volver al último corte» (`:1410-1421`) | La sustituye el periodo «Rango» |
| Columna «⋯» (`:1570-1581`) | Repetía la acción del nombre |
| Lista de altas y bajas (`:1635-1669`) | No está en el tablero; el motor sigue calculando la elegibilidad |
| `GuildWorkspaceChrome.tsx` y la interfaz de `GuildPersistencePanel.tsx` | La cuenta pasa a `/cuenta/` (§10.4) |
| `formatGuildNumber` en `pt-BR` (`guild-ranking.ts:565-567`) | `formatInteger` (§4.3, §13.3) |

### 10.15 Criterios de aceptación de Guild

1. **CA-10.1** Sin cortes, la página muestra `EmptyState` «Importa un export de guild para ver el análisis.», el botón «Importar» y «Exporta desde la ventana de guild del juego (Ctrl+J).». No hay KPI, gráfico ni tablas.
2. **CA-10.2** Pruebas unitarias de `guild-analytics.ts` con un historial sintético de 35 días que incluya un día sin corte, una semana que empieza en miércoles, un alta a mitad de semana y un miembro que cruza de tramo. Con `hoy` fijo:
   - KPI de «7 días» y comparación;
   - serie de 14 días, con el día sin corte como `null` y el corte siguiente con `Desde`;
   - las 5 filas semanales;
   - filas de miembros, inactivos y `niceTicks(10536)` = tope 12.000.
   - Todo coincide con valores calculados a mano en la prueba.
3. **CA-10.3** Un día sin corte no tiene barra y muestra «sin export» (e2e). Ninguna barra se dibuja con valor 0 por falta de datos.
4. **CA-10.4** La comparación de un KPI solo lleva porcentaje si los dos periodos tienen corte en todos sus días. Si no, dice «{c} de {n} días con export».
5. **CA-10.5** Con el umbral en 3, un miembro sin `Δd` ni `Δc` desde hace 3 días tiene el chip «Inactivo» y cuenta en «Inactivos (k)». Al subir el umbral a 5 y guardar, deja de contar.
6. **CA-10.6** «Cancelar» en «Metas y cálculo» revierte metas, puntos por daily, política y umbral. «Guardar» está desactivado sin cambios (A14).
7. **CA-10.7** «Exportar CSV» descarga exactamente la cabecera de §10.12 y una fila por miembro del filtro, en el orden actual. Con «Inactivos», solo los inactivos.
8. **CA-10.8** El PNG y el diálogo del miembro dan la misma banda de meta para un miembro que entró a mitad de semana.
9. **CA-10.9** La interfaz no tiene selector de zona horaria, «Ver JSON», WhatsApp ni Discord. Todas las horas llevan «(hora de Brasilia)».
10. **CA-10.10** El rango se muestra «Leader», «Vice-Leader» o «Member» en `es` y en `en`, nunca «Líder» ni «Membro».
11. **CA-10.11** (modo cuenta) Pasan las pruebas RLS de §10.13. «Importar export» no aparece para un `member`.
12. **CA-10.12** axe sin violaciones `serious` ni `critical` con el tooltip de un día abierto, el diálogo del miembro abierto y el filtro «Inactivos» (S12).
13. **CA-10.13** (modo cuenta, con la respuesta de Supabase retenida en la prueba) la región muestra «Cargando la guild…» y nunca «Importa un export de guild…» antes de la respuesta; con la petición fallida, muestra el `Notice` de error y «Reintentar», que al responder bien pinta el análisis. El HTML prerenderizado no contiene «Importa un export de guild para ver el análisis.».
14. **CA-10.14** «Quitar», «Eliminar guild» y «Eliminar cuenta» abren su `Dialog` con los textos de §10.4 y §9.9 y el foco en «Cancelar»; «Cancelar» y Escape cierran sin cambios.

---

## 11. Comparar Pokémon

Fuentes: R15, R16, A13, T14, `DS:DataTable`, `DS:NestedEntity`, `DS:GameTooltip` y `DS:ElementChip`. El lienzo no tiene tablero de Comparar. Este apartado define la herramienta para dibujar ese tablero. F5 empieza cuando el propietario lo apruebe (R15); hasta entonces la ruta es el marcador de §8.14 (E18), que F5 sustituye.

### 11.1 Punto de partida y alcance

`PokemonExplorer` (`src/components/tools/PokemonExplorer.tsx`, 399 líneas) tiene dos pestañas:
- «Comparar» compara dos Pokémon con dos `select` de 910 opciones (`:251-272`), con Bulbasaur y Charmander por defecto (`:89-92`);
- «Explorar tiers» es una lista filtrable (`:315-396`).

Muestra número, variante, generación, nivel, tier, función y elementos (`:175-199`).

**v2:**
- Se rehace la comparación desde cero, con 2 a 4 Pokémon.
- «Explorar tiers» sale: los tiers viven en la página «Tier list» de §8.8 (R15, E1). Esa pestaña se borra en la misma fase en que §8 publica la Tier list, nunca antes.

La herramienta solo muestra datos de registros:
- sin puntuaciones, «mejor», daño calculado ni colores de ventaja;
- no es una lista de entidades, así que no lleva `ViewToggle` (R3 se aplica a las listas).

### 11.2 Ruta y estado

- **Ruta:** `/{locale}/herramientas/pokemon/` (se conserva).
  - h1 y título «Comparar Pokémon» / «Compare Pokémon»;
  - migas «Pokémon › Comparar Pokémon», como la entrada del menú en el grupo Pokémon (`Lienzo:Main`);
  - sin kicker ni introducción (R12).
- **Estado:**
  - `?p=id1,id2,…` con los ids de `content/pokemon.json`. Se descartan los ids desconocidos y repetidos, y se toman como máximo 4.
  - `?add=id` añade un Pokémon al conjunto guardado. Hoy ninguna página enlaza así: la ficha sigue su tablero, que no tiene ese enlace, y la Tier list solo usa piezas del DS (§8.3, §8.8). El tablero de Comparar (R15) fija desde dónde se entra.
  - El conjunto se guarda por visitante en `localStorage` (`alliance-codex:comparar:v1`, en `try/catch`).
  - Cada cambio reescribe la URL con `?p=` mediante `history.replaceState`, así el enlace se puede compartir.
  - `?p=` manda sobre el conjunto guardado.
  - Con `?add=` y 4 Pokémon ya elegidos, no se añade y aparece `Notice` «Ya hay 4 Pokémon. Quita uno para añadir {nombre}.»
- **HTML prerenderizado:** migas, h1 y el estado vacío. La isla lee la URL al hidratar.

### 11.3 Selección

- **Añadir:** `Combobox` (§7.2.8) con etiqueta visible «Añadir Pokémon» y placeholder «Nombre o número».
  - La lista muestra todas las coincidencias en un listbox con desplazamiento (alto máximo 320). Cada opción lleva arte de 40, nombre, «Nº 6» y la marca Shiny si aplica.
  - Coincide por nombre normalizado o por número, con o sin «#» y con o sin ceros a la izquierda.
  - Teclado: flechas, Enter y Escape.
  - Elegir una opción añade una columna. Un Pokémon ya elegido aparece desactivado en la lista.
  - Con 4 elegidos, el control no se renderiza.
- **Quitar:** botón con aspa de 40 × 40 (44 en táctil) en la cabecera de cada columna. `aria-label` «Quitar {nombre}».
- Una región oculta con `aria-live="polite"` anuncia «{nombre} añadido.» / «{nombre} quitado.»
- **Sin selección:** `EmptyState` «Elige al menos dos Pokémon para compararlos.» y el control de añadir.
  - Con uno, la tabla se muestra con una columna.
- El orden de las columnas es el orden en que se añadieron. No se reordenan (§15).

### 11.4 Tabla comparativa

- `DataTable`, con caption oculto «Comparación: {nombres separados por comas}».
- **Primera columna:** encabezados de fila (`rowHeader`) de 160.
- **Una columna por Pokémon**, de ancho igual (mínimo 160). Cada encabezado lleva:
  - arte a 64 (el `imagen` del roster; sin imagen, la marca de sprite faltante, R11);
  - el nombre como `NestedEntity`, enlazado a `/{locale}/pokedex/{id}/` y con `pokemonTip` (§7.5.3);
  - la marca Shiny si aplica;
  - el botón «Quitar».
- `ToggleGroup` «Filas», con «Todas las filas» y «Solo diferencias», encima de la tabla y solo con 2 o más columnas. «Solo diferencias» oculta las filas cuyo valor mostrado es idéntico en todas las columnas.

### 11.5 Filas

Solo datos de registros, en este orden, con las etiquetas de T14:

| Fila | Fuente | Valor |
|---|---|---|
| Número | `numero` | «Nº 6» (`formatDexNumber`, §13.3) |
| Generación | `generacion` | «1» |
| Variante | `variante` | «Normal» / «Shiny» |
| Requisito | `nivel` | «Nivel 120» (Q5) |
| Tier | `tier` | `formatTier` («T1», «Legendary») |
| Rol | `funcion` | «PVE» / «PVP» |
| Elementos | `elementos` | `ElementChip` con tooltip, con los nombres de `content/elementos.json` (§8.0.5) |
| Ataques | `content/moves.json`, registros cuyo `pokemon` incluye el id | Nombres como texto, en el orden del registro: §7.5.3 no define tooltip de movimiento (R2) |
| Addons | `content/outfits.json`, addons del id | Nombres |
| Otras | Todo dato por Pokémon que la ficha lee de un registro (drops, evolución, dónde encontrarlo, habilidades; §8.3) | Con la forma que le da la ficha |

- Una fila aparece si al menos una columna tiene valor. «—» donde una columna no lo tiene (R7, T32).
- Los registros `borrador` se omiten con `OCULTAR_BORRADORES=1`.
- No hay filas calculadas.

### 11.6 Responsive y accesibilidad

- **A 944:** 160 + 4 × 196.
- **Por debajo de 768:**
  - desplazamiento horizontal dentro de un contenedor enfocable con `role="region"` y `aria-label` igual al caption, como hoy `PokemonExplorer.tsx:288-293`;
  - la primera columna queda fija (`position: sticky`, fondo `bg-primary`).
- Encabezados con `scope`. El foco vuelve al control de añadir tras quitar una columna. Todo objetivo mide 44 × 44 en táctil (S14).

### 11.7 Qué sale del código

- `PokemonExplorer.tsx` completo;
- el kicker y la introducción de `src/pages/[locale]/herramientas/pokemon.astro` (textos en `:18-19` y `:26-27`, marcado en `:46` y `:48`);
- las ayudas de `src/lib/tools/pokemon-roster.ts` que formatean para la interfaz, sustituidas por los formateadores de `src/lib/format/` (§13.3): `getRosterRoleLabel` devuelve «—» (`:29-31`) y `getRosterElementsLabel` une en minúsculas (`:33-35`). El módulo se conserva solo si otra isla lo importa.

### 11.8 Criterios de aceptación de Comparar

1. **CA-11.1** `/es/herramientas/pokemon/` sin parámetros ni almacenamiento muestra «Elige al menos dos Pokémon para compararlos.» y el control de añadir. No preselecciona ningún Pokémon.
2. **CA-11.2** `?p=bulbasaur,shiny-charizard,zzz,bulbasaur` muestra exactamente 2 columnas, Bulbasaur y Shiny Charizard, y reescribe la URL a `?p=bulbasaur,shiny-charizard`.
3. **CA-11.3** Con 4 columnas, el control de añadir no existe. `?add=` con 4 muestra el `Notice` de §11.2 y no cambia la tabla.
4. **CA-11.4** Las filas y los valores coinciden con `content/pokemon.json` para los ids elegidos (e2e contra el registro). Un campo `null` se ve «—». Una fila sin valor en ninguna columna no existe.
5. **CA-11.5** «Solo diferencias», con Bulbasaur y Shiny Bulbasaur, oculta Número, Generación, Rol y Elementos, y conserva Variante, Requisito y Tier.
6. **CA-11.6** El nombre de cada columna y cada elemento abren su tooltip con hover, foco y toque. Shift lo fija y Escape lo cierra (S3).
7. **CA-11.7** A 390, la tabla se desplaza dentro de su región, la primera columna queda visible y la página no se desborda (S1).
8. **CA-11.8** La pestaña «Explorar tiers» solo desaparece cuando existe la Tier list de §8.8.
9. **CA-11.9** axe sin violaciones `serious` ni `critical` con 0, 1 y 4 columnas y con el combobox abierto (S12).

---

## 12. Barrido anti-slop y sin procedencia

### 12.0 Alcance y cómo leer esta sección

- **Qué cubre.** Todo texto visible, nombre accesible, `title`, `alt`, `placeholder`, metadato y control del árbol de trabajo del 2026-09-19 (sin commit) en `src/pages`, `src/layouts`, `src/components`, `src/i18n` y `src/lib` (incluido `src/lib/content`), más los valores de `content/` que llegan a la pantalla.
- **Fuentes de la regla.** P4 y D-010 (anti-slop), D-012 (sin procedencia), D-013 (Pokédólares), la guía de textos (`DS:guias/50`) y la de dinero (`DS:guias/40`).
- **Referencias `archivo:línea`.** Verificadas contra el árbol del 2026-09-19.
- **Acciones:**
  - **BORRAR**: la cadena o el elemento desaparece.
  - **REESCRIBIR**: se sustituye por el texto final indicado (es / en).
  - **MOVER**: pasa al diccionario de §13.2 sin cambiar el texto.
  - **MARCAR**: se envuelve en `lang="en"`.
  - **CONSERVAR**: se queda como está (con el cambio indicado, si lo hay).
- **Precedencia (§1.1).** §12 fija el **texto**; §8–§11 fijan la **estructura**. Una fila cuyo control o sección retiran §8–§11 se cierra borrando. Las superficies que §9 (Comercio), §10 (Guild) y §11 (Comparar) rehacen desde cero se cierran borrando su archivo. Sus filas aquí sirven de lista de lo que **no puede reaparecer** y dan los mensajes que esa sección no fija; donde esa sección fija un texto, manda ella. Todo texto nuevo debe pasar el centinela de §12.22.
- **Abreviaturas de archivo:** las de «Cómo leer este documento».

### 12.1 Reglas generales (valen para todo archivo nuevo o existente)

| ID | Regla | Cómo se comprueba |
|---|---|---|
| G1 | Sin kicker ni eyebrow. Entre las migas y el `h1` no hay texto; no existe la clase `eyebrow`. | Centinela (§12.22) y `contract.spec.ts`: 0 elementos `.eyebrow`; el hermano anterior del `h1` dentro de su cabecera es la miga o nada. |
| G2 | Sin eslogan ni intro que repita el título o explique la página. El subtítulo de `PageTitle` solo lleva un dato (p. ej. «(Potenciación)»). La línea del Inicio lleva cifras calculadas. | Revisión del PR y centinela. |
| G3 | Sin texto de proceso, estado del proyecto o del pipeline: «próximamente», «hoja de ruta», «preview», «borrador local», «se habilitará», «todavía no es un mapa…». Se permite un estado vacío que describe los datos: «Aún no hay cambios publicados.». | Centinela. |
| G4 | Sin texto de desarrollador ni valores internos: ids (`#2`, `flagId`), enums (`training_charger`, `availability_scope`, `normal`), claves JSON (`exportedAt`, `members`), zonas IANA, nombres de librerías o servicios (Temporal, Supabase). Un enum se muestra solo a través de un diccionario; sin entrada, se omite. | Centinela y `tests/i18n/forbidden.test.ts`. |
| G5 | Sin procedencia (D-012): ni fuentes, ni «verificado el», ni confianza, ni fecha de obtención, en datos, pantallas, `title`, `alt` ni metadatos. «Contacto verificado» es una función de Comercio (verificación de canales, D-009), no procedencia; «verificado» solo aparece en ese contexto. | Centinela. |
| G6 | El dinero del juego se llama «Pokédólares» / «Pokédollars». Nunca «KK», «KKs» ni «gold». El sprite `ui/pokedolares` va antes de cada importe (D-013, `40-dinero.md`). | Centinela y `money.spec.ts` (§14.3). |
| G7 | Solo cifras de los datos o del usuario. Los conteos se calculan en el build o en el cliente, nunca se copian de los tableros. Un dato desconocido se muestra «—» (U+2014) solo si otras filas o tarjetas del mismo conjunto lo tienen; nunca 0 ni «N/D». En el tooltip del juego la fila se omite. | Unitarias de formato y `smoke.spec.ts` (conteos = longitud de los datos). |
| G8 | Todo lo que parece control actúa. Un keycap solo existe con su manejador. Un chevron solo existe si abre algo. Un icono decorativo no tiene forma de botón. Un `title` nunca duplica el texto visible. | `contract.spec.ts` (§14.3). |
| G9 | Los componentes y páginas no llevan ternarios de idioma (`locale === 'es' ? … : …`). Todo texto sale de §13.2. Los componentes del sistema de diseño reciben sus textos en los dos idiomas; ninguna página `en` usa los textos por defecto en español. | `rg "locale === '(es\|en)'" src/components src/pages src/layouts` sin resultados; centinela `en`. |
| G10 | Sin duplicados. Un bloque no enlaza dos veces el mismo destino con textos distintos. Ningún badge repite un conteo visible. Ningún `aria-label` tapa el texto visible (WCAG 2.5.3). | `a11y.spec.ts` (regla axe `label-content-name-mismatch`) y revisión. |
| G11 | Sin decoración que imite interfaz: «↗», «→», «←», «✦» y «?» como glifos de texto, luces de dispositivo, órbitas, marcas de agua de Poké Ball. Las flechas reales son SVG `aria-hidden` del sistema de diseño. | Centinela (glifos). |
| G12 | Ningún enlace apunta a una ruta inexistente o retirada. Ningún grupo del menú queda sin destino real. | `links.spec.ts` (§14.3). |
| G13 | Sin emoji ni exclamaciones. Mayúsculas solo en «DESTACADOS» y en el nombre del tooltip (sistema de diseño). | `tests/i18n/forbidden.test.ts` sobre los diccionarios (los datos del usuario, como un nickname, pueden llevarlos). |
| G14 | Ninguna anotación de diseño en la interfaz («3 columnas de 304 px», «Hover #22262F»). | Centinela (regex `\b\d+\s?px\b` en texto visible). |

### 12.2 Shell (`AL`, `CFG`, `AW`, `WS`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| S-01 | `AL:39`, `:101` | título por defecto «Alliance Codex» dentro de «{title} · Alliance Codex»; el Inicio sale «Inicio · Alliance Codex» | REESCRIBIR: prop `documentTitle` para el Inicio; el resto usa la plantilla (§13.5) | «Alliance Codex · Wiki de PokeAlliance» | «Alliance Codex · PokeAlliance wiki» |
| S-02 | `AL:40` | descripción por defecto en español también en `en` | BORRAR el valor por defecto; la descripción pasa a prop obligatoria (§13.5) | — | — |
| S-03 | `AL:45`, `:106`, `:108` | `isHome`, `wiki-shell-home`, `wiki-topbar-inner-home` (mismos estilos) | BORRAR | — | — |
| S-04 | `AL:15-28`, `:48-79` | iconos lucide en el menú (Swords repetido en Rotaciones y Comparar; Map repetido en Mapa y Aportar) | BORRAR. Solo el grupo «Destacados» lleva sprites del juego (sistema de diseño) | — | — |
| S-05 | `AL:55` | enlace «Herramientas» dentro del grupo «Herramientas» | BORRAR del menú | — | — |
| S-06 | `AL:58` | «Comparar Pokémon» escrito en línea | MOVER a `shell.nav.compare` | «Comparar Pokémon» | «Compare Pokémon» |
| S-07 | `AL:64` | «Ranking de guild» escrito en línea | REESCRIBIR como en el tablero Main | «Guild» | «Guild» |
| S-08 | `AL:69` | ítem «Buscar» (la búsqueda está en la cabecera) | BORRAR | — | — |
| S-09 | `AL:73` | ítem «Cambios» | CONSERVAR (A2 rechazada); la página lleva el estado vacío de C-05 | «Cambios» | «Changes» |
| S-10 | `AL:74-79` | «Aportar al mapa» / «Contribute to map» | BORRAR (A1); la ruta redirige (R-03). El tablero Main aún lo muestra (X1; desviación DV2 de §14.5) | — | — |
| S-11 | `AL:96` | `theme-color` `#111318` (fuera de los tokens) | REESCRIBIR a `bg-primary` | `#0c0e12` | `#0c0e12` |
| S-12 | `AL:99-100` | `hreflang` relativos que apuntan a las raíces | REESCRIBIR según §13.5 | — | — |
| S-13 | `AL:105`; `CFG:33/52` | «Saltar al contenido principal» | REESCRIBIR (`SkipLink` del sistema de diseño) | «Saltar al contenido» | «Skip to content» |
| S-14 | `AL:112`; `AW:3`, `:6`, `:33-34` | `aria-label` de la marca; wordmark SVG con «ALLIANCE» / «CODEX» en mayúsculas y variante `home` muerta | BORRAR `AW` completo y el `aria-label`. La marca es el texto visible «Alliance Codex» (`brand`), que ya da el nombre | «Alliance Codex» | «Alliance Codex» |
| S-15 | `AL:117-130` | `<input>` en la cabecera, etiqueta oculta «Buscar en Alliance Codex» (`:120`) y placeholder «Busca Pokémon, items o quests» (`:127`, «quests» en inglés) | REEMPLAZAR por `SearchTrigger` `header` (abre la paleta) | «Buscar...» y keycap «Ctrl + K» | «Search...» y «Ctrl + K» |
| S-16 | `AL:133-142` | enlace de idioma con `aria-label` «Cambiar a English» / «Switch to Español» (`:137`, no contiene la etiqueta visible), destino en la raíz (`:135`) y chevron sin lista (`:141`) | REESCRIBIR como selector del sistema de diseño: muestra el idioma actual y abre la lista de dos opciones; cada opción lleva a la misma ruta, consulta y ancla en el otro idioma (§13.1) | nombre «Idioma: Español»; opciones «Español» (`lang="es"`), «English» (`lang="en"`) | «Language: English»; mismas opciones |
| S-17 | `AL:143-158` | `PanelLeftIcon` y `MoonIcon` con `title` «Navegación lateral» / «Tema oscuro»: iconos sin acción con forma de botón | BORRAR. El botón de tema del sistema de diseño se rige por X2 y PZ-01 (§12.21) | — | — |
| S-18 | `AL:164` | `aria-label` del menú puesto en el `<aside>` | MOVER al `<nav>` | «Principal» | «Main» |
| S-19 | `AL:167`, `:184`, `:201` | encabezados «Explorar», «Herramientas», «Comunidad» como `<p>` | REESCRIBIR como grupos plegables del sistema de diseño, con los nombres del tablero Main | «Destacados», «Pokémon», «Sistemas», «Ítems», «Actividades», «Herramientas», «Comunidad» | «Featured», «Pokémon», «Systems», «Items», «Activities», «Tools», «Community» |
| S-20 | `AL:226-229` | «Servidor» + «Server Save · 00:00 BR» (abreviatura, igual en los dos idiomas) | BORRAR (no está en la barra lateral aprobada) | — | — |
| S-21 | `AL:232-246` | `<details>` móvil con `summary` «Navegación principal» y 13 enlaces sin grupos | REEMPLAZAR por `MobileMenu` con los mismos grupos que la barra lateral | botón «Abrir menú»; diálogo «Menú»; cierre «Cerrar menú» | «Open menu»; «Menu»; «Close menu» |
| S-22 | `AL` (sin pie) | no hay aviso de no afiliación | AÑADIR `Footer` (A5) | el texto de A5 (`shell.footer`, §13.2) | el de A5 |
| S-23 | `CFG:27-29/47-49`, `:66-68` | claves sin uso `language`, `status` («Estado del proyecto»), `publicFoundation` («Fundación pública») | BORRAR | — | — |
| S-24 | `CFG:40/59` | menú «Rotaciones» frente al h1 «Rotaciones y tiers» | REESCRIBIR (§8.8, E1) | «Tier list» | «Tier list» |
| S-25 | `WS:30`, `:33`, `:37`, `:44` | `aria-label` = placeholder completo; id de respaldo `global-search` duplicado; `Kbd` «Ctrl K» sin manejador | BORRAR `WS` completo. El Inicio usa `SearchTrigger` `home` | «Busca Pokémon, ítems, sistemas…» | «Search Pokémon, items, systems…» |

### 12.3 Raíz, 404 y rutas retiradas

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| R-01 | `ROOT:4` | `Astro.redirect` en una página prerenderizada. El build emite un meta refresh de 2 s con «Redirecting from / to /es/» en inglés (`dist/client/index.html`) | BORRAR `ROOT`; redirección **302** de configuración `/` → `/es/` (§13.1) | — | — |
| R-02 | 404 (no existe) | la ruta comodín de `.vercel/output/config.json` responde con el 404 por defecto de Astro, en inglés y sin shell | AÑADIR la página 404 con shell, `noindex` y estado 404 (§8.12, §13.5). Las rutas bajo `/en/` reciben la versión `en` | h1 «Página no encontrada»; `SearchTrigger` y Destacados (§8.12) | «Page not found» |
| R-03 | `AP` (archivo completo) | página de aportes sin canal de envío: tabla con `spawn_area, hunt_entrance…` (`AP:30/60`), «Todavía no hay envío automático…» (`AP:38-39/68-69`), índice «Resumen» (`AP:143-148`) y enlace «Volver al mapa →» (`AP:139`) | BORRAR el archivo (A1); redirección **302** `/{l}/mapa/aportar/` → `/{l}/mapa/` | — | — |

La línea de privacidad de `AP:40-41/70-71` se reescribe y se guarda para la futura página de aportes (§15): «No compartas contraseñas ni datos de tu cuenta.» / «Don't share passwords or account details.».

### 12.4 Inicio (`HOME`, `SSS`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| H-01 | `HOME:34/54` | título «Inicio» / «Home» | REESCRIBIR con `documentTitle` (S-01) | — | — |
| H-02 | `HOME:35/55` | «Pokédex, mapa, guías y herramientas de PokeAlliance.» | REESCRIBIR según §13.5 | — | — |
| H-03 | `HOME:36/56`, `:96` | kicker «Alliance Codex» | BORRAR | — | — |
| H-04 | `HOME:37/57`, `:97` | h1 eslogan «Encuentra lo que necesitas para jugar.» | REESCRIBIR (`HomeIntro`, §8.1); `{n}` = número de registros de `content/pokemon.json` en el build (910 hoy) y `{lista}` = las colecciones publicadas (X12) | h1 «Bienvenido a Alliance Codex»; línea «{n} variantes de Pokémon, {lista} de PokeAlliance.», con «ítems», «sistemas» y «actividades» | «Welcome to Alliance Codex»; «{n} Pokémon variants, {list} from PokeAlliance.» |
| H-05 | `HOME:38/58`, `:101-102` | etiqueta y placeholder «Buscar Pokémon, items, misiones o sistemas» | REESCRIBIR (`SearchTrigger` `home`). La paleta encuentra sistemas (§8.6) | «Busca Pokémon, ítems, sistemas…» | «Search Pokémon, items, systems…» |
| H-06 | `HOME:39/59`, `:106-109` | CTA «Explorar Pokédex» con ↗ | BORRAR | — | — |
| H-07 | `HOME:40-41/60-61`, `:112-132` | bloque «Pokédex de PokeAlliance», «Ver todos los Pokémon ↗», tres iniciales fijos y `onerror` en línea | BORRAR | — | — |
| H-08 | `HOME:42/62`, `:135-138` | h2 «Explorar la wiki» sobre una copia del menú | BORRAR; lo sustituyen Destacados y los paneles índice (§8) | — | — |
| H-09 | `HOME:43-50/63-70`, `:139-154` | cuatro tarjetas con descripción, `aria-label` que tapa la descripción (`:142`), fragmentos vacíos (`:145-148`) y `ArrowUpRightIcon` en enlaces internos (`:150`) | BORRAR | — | — |
| H-10 | `HOME:79-87` | iconos lucide (lupa para Guías, espadas para Herramientas) | BORRAR | — | — |
| H-11 | `HOME:20`, `:157-159`; `SSS` completo | Server Save calculado con `Temporal.Now` al prerenderizar (fecha congelada del build); h2 «Server Save» (`SSS:22/27`); «Hora canónica convertida a tu zona» (`SSS:23/28`, `:40`); badge «Temporal» (`SSS:37`); «Tu fecha local: America/Sao_Paulo» (`SSS:24/29`, `:46`); fecha ISO en mono (`SSS:43`); «00:00 · America/Sao_Paulo» (`SSS:49`) | BORRAR (A17, Q7). Si la respuesta a Q7 lo reubica, se calcula en el cliente | si Q7 lo reubica: «Server Save: 00:00 (hora de Brasilia)» | «Server Save: 00:00 (Brasília time)» |

### 12.5 Buscar (`BUS`, `CS`)

La búsqueda principal es la paleta de `SearchTrigger` (§7). Estas filas valen para la ruta `/{l}/buscar/` (§8.6) y para la paleta en lo que comparten.

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| B-01 | `BUS:18/24` | h1 «Buscar en el Codex» / «Search the Codex» | REESCRIBIR | «Buscar» | «Search» |
| B-02 | `BUS:20/26`, `:43` | eyebrow «Wiki Core / Search» (en inglés en `es`; oculto por `w:512-514`) | BORRAR | — | — |
| B-03 | `BUS:21/27`, `:45` | intro «Cada resultado lleva a su ficha o a su sección.» | BORRAR | — | — |
| B-04 | `CAM:32-39`, `IDX:57-64`, `DET:73-82`, `GUI:47-54`, `SIS:45-52`, `ROT:40-47`, `TI:71-78`, `TPK:35-44`, `GA:37-46`, `MI:36-45`, `COM:44-51`; también `BUS:34-41`, que se borran sin sustituto (E4) | migas con `aria-label` «Ruta de navegación» y separadores «/» que se leen en voz alta | REEMPLAZAR por `Breadcrumb` (separadores `aria-hidden`, último elemento con `aria-current="page"`); la ruta de migas la fijan §8.0.4 y §9–§11 | nombre del landmark «Migas de pan» | «Breadcrumb» |
| B-05 | `BUS:29`, `:48`; `CS:49-50` | `q` leído con `Astro.url` en una página prerenderizada: en el build siempre llega vacío | BORRAR la prop `initialQuery`; el cliente lee `location.search` (§12.20, punto 1) | — | — |
| B-06 | `CS:25/32`, `:80` | placeholder y etiqueta «Buscar Pokémon, misión, objeto o sistema…» (con «…» dentro del nombre accesible) | REESCRIBIR | placeholder «Busca Pokémon, ítems, sistemas…»; etiqueta «Buscar» | «Search Pokémon, items, systems…»; «Search» |
| B-07 | `CS:26/33`, `:94-97` | botón «Buscar» sin efecto visible | BORRAR | — | — |
| B-08 | `CS:27/34`, `:100-105` | conteo antes de escribir, en mono y mayúsculas; «1 resultados» | REESCRIBIR: solo con consulta, plural con `Intl.PluralRules`, `aria-live="polite"` | «1 resultado» / «{n} resultados» | «1 result» / «{n} results» |
| B-09 | `CS:28/35`, `:129-131` | «No hay registros que coincidan con esa búsqueda.» | REESCRIBIR | «Sin resultados para «{q}».» | «No results for “{q}”.» |
| B-10 | `CS:57` | sin consulta se listan los 915 registros | REESCRIBIR: sin consulta no hay lista ni conteo | — | — |
| B-11 | `CS:116`, `:117` | kicker de colección en cada fila y un `<h2>` por fila | REESCRIBIR con `ListRow`: Pokémon con sus elementos (§13.4); otras colecciones con su etiqueta como meta, sin mayúsculas ni encabezado | — | — |
| B-12 | `CS:121` (vía `REPO:156-169`) | meta con valores internos: `normal`, `shiny`, `PVE`, `training_charger`, `availability_scope` | REESCRIBIR por diccionario (`normal` se omite; `shiny` → `ShinyMark`); sin entrada se omite | — | — |
| B-13 | `CS:122-124` | resúmenes en inglés en la página `es` | MARCAR `lang="en"` | — | — |
| B-14 | `CS:85`, `:94` | campo y botón deshabilitados hasta hidratar | BORRAR `disabled` (§12.20, punto 2) | — | — |

`CS:29/36` «Mostrar más» / «Show more» sale: lo sustituye `Pagination` (§7.7, §8.6).

### 12.6 Cambios (`CAM`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| C-01 | `CAM:16/23` | descripción | REESCRIBIR según §13.5 | — | — |
| C-02 | `CAM:17/24`, `:43` | intro «Historial conciso de actualizaciones importantes…» | BORRAR | — | — |
| C-03 | `CAM:41` | eyebrow «Historial de la wiki» | BORRAR | — | — |
| C-04 | `CAM:47` | eyebrow «Sin entradas todavía» | BORRAR | — | — |
| C-05 | `CAM:18/25`, `:48-50` | h2 «El registro todavía no tiene entradas publicadas.» | REESCRIBIR como `EmptyState` (`<p>`, no encabezado) | «Aún no hay cambios publicados.» | «No changes published yet.» |
| C-06 | `CAM:19/26`, `:51` | «Las novedades se incorporarán aquí cuando estén listas para consulta.» | BORRAR | — | — |

Se conserva: `CAM:15/22` h1 «Cambios» / «Changes».

### 12.7 Pokédex: índice (`IDX`, `GRID`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| P-01 | `IDX:20/28` | descripción | REESCRIBIR según §13.5 | — | — |
| P-02 | `IDX:21/29`, `:71` | kicker «Archivo de campo» / «Field archive» | BORRAR | — | — |
| P-03 | `IDX:22/30`, `:73` | intro «Encuentra una especie, reconoce su variante y abre su ficha.» | BORRAR | — | — |
| P-04 | `IDX:23-24/31-32`, `:75-79` | «Registro PokeAlliance · 910 · entradas» (duplica el conteo) | BORRAR | — | — |
| P-05 | `IDX:67-69`, `:81` | luces de «dispositivo» y marca de Poké Ball | BORRAR | — | — |
| P-06 | `IDX:84` | `aria-label="Pokédex"` en `<section>` (repite el h1) | BORRAR | — | — |
| P-07 | `IDX:52`; `GRID:92`, `:159-165` | `q` desde `Astro.url` y filtros fuera de la URL | REESCRIBIR (§12.20, punto 3) | — | — |
| P-08 | `GRID:40/59`, `:182`, `:191` | buscador «Buscar por nombre, número, tipo o rol» | BORRAR (el tablero Pokédex no lo tiene; la paleta busca, E3) | — | — |
| P-09 | `GRID:102-117`, `:196` | atajo global «/» sin modificador y su `kbd` visible en táctil | BORRAR (A22) | — | — |
| P-10 | `GRID:41/60`, `:220` | `aria-label` «Filtros de la Pokédex» en un `div` sin rol | REEMPLAZAR por `FilterBar` con las etiquetas del tablero | «Generación», «Tier», «Elemento», «Variante»; opciones «Todas» (Generación, Variante), «Todos» (Tier, Elemento) | «Generation», «Tier», «Element», «Variant»; «All» |
| P-11 | `GRID:42/61`, `:200`, `:212` | leyenda y opción «Todas las variantes» | REESCRIBIR (conmutador de variante del tablero) | «Todas», «Normal», «Shiny» | «All», «Normal», «Shiny» |
| P-12 | `GRID:45/64`, `:222`, `:231`; `GRID:46/65`, `:241`, `:250` | etiquetas ocultas «Todas las generaciones», «Todos los tipos» | REESCRIBIR según P-10; se conserva la opción «Generación {n}» / «Generation {n}» | — | — |
| P-13 | `GRID:253`, `:338`; `DET:67`, `:108` | nombres de elemento en inglés capitalizados («Fire») también en `es` | REESCRIBIR con los nombres de `content/elementos.json` (§8.0.5) | «Fuego» | «Fire» |
| P-14 | `GRID:47-49/66-68`, `:260-268` | orden con etiqueta «Número Pokédex» igual a su primera opción | BORRAR (el tablero no tiene orden; §8.0.6) | — | — |
| P-15 | `GRID:50/69`, `:278` | «{n} Pokémon encontrados» | REESCRIBIR con plurales; `{a}` y `{b}` calculados | «{n} variantes», «{a} normales», «{b} Shiny» (singular «1 variante», «1 normal») | «{n} variants», «{a} normal», «{b} Shiny» |
| P-16 | `GRID:277` | `SlidersHorizontalIcon` junto al conteo, sin acción | BORRAR | — | — |
| P-17 | `GRID:275` | `aria-live` que envuelve también el botón | REESCRIBIR: `aria-live="polite"` solo en el conteo | — | — |
| P-18 | `GRID:280-284` y `:351-353` | «Limpiar filtros» duplicado cuando la lista está vacía | CONSERVAR uno: solo en el estado vacío | «Limpiar filtros» | «Clear filters» |
| P-19 | `GRID:54/73`, `:296` | `aria-label` «Abrir ficha de {name}» (tapa tier, tipos y rol) | BORRAR; el enlace del título de `DexCard` se nombra con el nombre | — | — |
| P-20 | `GRID:56/75` | clave `level: 'Tier'` sin uso | BORRAR | — | — |
| P-21 | `GRID:305`; `DET:87-89`; `ROS:13` | «#006» | REESCRIBIR como en el tablero | «Nº 6» | «No. 6» |
| P-22 | `GRID:307-308`; `DET:90-91` | aro decorativo e inicial de respaldo visible a través del sprite transparente | BORRAR el aro; el respaldo es la marca de sprite faltante y solo aparece con error de imagen | — | — |
| P-23 | `GRID:320` | `title` «Outfit #{id}» (id interno) | BORRAR | — | — |
| P-24 | `GRID:324`; `DET:126` | glifo ✦ | REEMPLAZAR por `ShinyMark` (`role="img"`) | nombre «Shiny» | «Shiny» |
| P-25 | `GRID:332` | rol «—» en cada tarjeta sin rol | REESCRIBIR con la regla de la unión (G7): «—» solo si otra tarjeta del resultado tiene rol | — | — |
| P-26 | `GRID:333` | «Normal» / «Shiny» sueltos en la meta | REESCRIBIR como hecho de la tarjeta | «Variante»: «Normal» / «Shiny» | «Variant» |
| P-27 | `GRID:349` | glifo «?» del estado vacío | BORRAR | — | — |
| P-28 | `GRID:51/70`, `:357-368` | «Mostrar más Pokémon» + «48 / 910», sin efecto sin JS | REEMPLAZAR por `Pagination` con enlaces reales (§12.20, punto 77) | «Paginación»; «Anterior», «Siguiente», «Página {n}» | «Pagination»; «Previous», «Next», «Page {n}» |
| P-29 | `GRID:186`, `:199`, `:224`, `:243`, `:262` | controles deshabilitados hasta hidratar | BORRAR `disabled` | — | — |

Se conservan: `IDX:19/27` h1 «Pokédex»; `GRID:52/71` «No hay Pokémon que coincidan con estos filtros.» / «No Pokémon match these filters.».

### 12.8 Ficha de Pokémon (`DET`, `OUT`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| D-01 | `DET:71` | descripción «{nombre} · Alliance Codex», igual en los dos idiomas | REESCRIBIR con la plantilla de §13.5 | — | — |
| D-02 | `DET:23` | redirección inalcanzable en una página prerenderizada | BORRAR | — | — |
| D-03 | `DET:41/55`, `:161` | «Volver a la Pokédex» (duplica la miga) | BORRAR | — | — |
| D-04 | `DET:42/56`, `:105` | eyebrow «Pokédex» sobre el nombre | BORRAR | — | — |
| D-05 | `DET:43/57`, `:148` | `aria-label` «Resumen» del paginador anterior/siguiente | BORRAR con el paginador (X11) | — | — |
| D-06 | `DET:153`, `:166` | «←» y «→» como texto | BORRAR con el paginador (X11) | — | — |
| D-07 | `DET:96` | alt «{nombre}, sprite de PokeAlliance» (también en `en`) | REESCRIBIR como `alt=""`: el nombre está en el h1 y en la ficha (§8.3) | — | — |
| D-08 | `DET:98`; `HOME:122`; `GUI:82` | `onerror="this.remove()"` en línea (incompatible con una CSP estricta) | BORRAR; el error de imagen lo resuelve el componente `Sprite` o la isla (§7) | — | — |
| D-09 | `DET:110-115` | «Tier», «Rol», «Nivel», «Generación» con «—» | REESCRIBIR como ficha fija `GameTooltip` (`role="group"`, nombre «Ficha de {nombre}»). Filas del tablero; una fila sin valor se omite (no se escribe «—») | «Requisito:» «Nivel {n}»; «Tier:»; «Elementos:» «Fuego / Volador»; «Rol:»; «Generación:» | «Requirement:» «Level {n}»; «Tier:»; «Elements:» «Fire / Flying»; «Role:»; «Generation:» |
| D-10 | `DET:119`, `:126` | «Variantes» con enlaces «✦ Shiny» / «Normal» (Smeargle: 20 enlaces, 19 dicen «Normal») | BORRAR: la sección «Tier list» de §8.3 enlaza las variantes por su `nombre` | — | — |
| D-11 | `OUT:158/166`, `:212`, `:215` | «Outfit del juego · #{outfitId}» (id interno) | REESCRIBIR | «Outfit» | «Outfit» |
| D-12 | `OUT:162/170`, `:285-289` | «La aura no está disponible en este navegador.» (error gramatical; también aparece si falla la imagen, `OUT:198-200`) | REESCRIBIR y separar los dos errores; el de imagen muestra la marca de sprite faltante sin texto (§8.3) | «El aura no está disponible en este navegador.» | «Aura preview isn't available in this browser.» |
| D-13 | `OUT:223` | alt «{name} · south» (clave interna en inglés) | REESCRIBIR con la dirección localizada | «{nombre}, Sur» | «{name}, South» |
| D-14 | `OUT:235`, `:239`; `OUT:254-255` | etiqueta visible repetida como `aria-label` del grupo | REESCRIBIR con `aria-labelledby`; el selector de dirección sale (X11) | «Aura» | «Aura» |
| D-15 | `OUT:256-267` | «Sin aura» solo como icono de Ultra Ball, con `aria-label` y `title` | REESCRIBIR como `ToggleGroup` de texto del tablero | «Ninguna», «Alliance», «Premier» | «None», «Alliance», «Premier» |
| D-16 | `OUT:273-274` | `aria-label` y `title` duplicados en cada aura | BORRAR (queda el texto visible) | — | — |

Se conservan: la miga «Pokédex»; `OUT:163/171` «Sur» / «South», solo en el `alt` de D-13. «Oeste», «Norte» y «Este» salen con el selector de dirección (X11).

### 12.9 Actividades, antes Guías (`GUI`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| Q-01 | `GUI:24/35`, `:57` | intro «Misiones, recompensas y rutas disponibles en el archivo.» | BORRAR | — | — |
| Q-02 | `GUI:63`, `:119` | conteos «1» en mono, sin etiqueta | BORRAR | — | — |
| Q-03 | `GUI:71` | kicker «Quest» (en inglés; repite el h2) | BORRAR | — | — |
| Q-04 | `GUI:73`, `:93`, `:104`, `:138`, `:144` | resumen, pasos, recompensas, acceso y viaje en inglés en la página `es` | MARCAR `lang="en"` | — | — |
| Q-05 | `GUI:27/38`, `:75-76` | «Nivel requerido» con «—» | REESCRIBIR como en el banner del sistema de diseño; sin valor, se omite | «Requisito: Nivel {n}» | «Requirement: Level {n}» |
| Q-06 | `GUI:79-84` | arte atado al slug `porygon-quest-dr-vektor`, inicial «P» y `<img>` sin dimensiones | REESCRIBIR: el sprite sale del campo `sprite` de la actividad (§8.9), con `width` y `height`; sin sprite, la marca de sprite faltante | — | — |
| Q-07 | `GUI:92` | «01»…«06» manuales dentro de un `<ol>` (se anuncian dos veces) | BORRAR | — | — |
| Q-08 | `GUI:103` | viñetas «✦» | BORRAR | — | — |
| Q-09 | `GUI:125-127` | columna con `MapPinIcon` que parece enlace al mapa | BORRAR | — | — |
| Q-10 | `GUI:130` | «{tipo ?? '—'} · {region ?? '—'}» con el enum crudo (`city`) | BORRAR con la sección de ubicaciones (§8.9) | — | — |
| Q-11 | `GUI:30/41`, `:133` | «Ruta de viaje» sobre requisitos y viajes mezclados | BORRAR con la sección de ubicaciones (§8.9) | — | — |
| Q-12 | `GUI:137`, `:143` | `ArrowUpRightIcon` (enlace externo) sobre texto que no es enlace | BORRAR | — | — |
| Q-13 | `GUI:144` | «{modo}: {comando}» | BORRAR con la sección de ubicaciones (§8.9) | — | — |

Se conservan: `GUI:28-29/39-40` «Pasos», «Recompensas» / «Steps», «Rewards». El h1 pasa a «Actividades» / «Activities»; «Misiones» y «Ubicaciones y viaje» salen (§8.9, A7).

### 12.10 Sistemas (`SIS`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| Y-01 | `SIS:19/31` | descripción «Objetos y movimientos que ayudan a entender…» | REESCRIBIR según §13.5 | — | — |
| Y-02 | `SIS:20/32`, `:54` | eyebrow «Wiki Core / Sistemas» (nombre de fase) | BORRAR | — | — |
| Y-03 | `SIS:21/33`, `:56` | intro «Consulta de forma directa qué hace cada objeto…» | BORRAR | — | — |
| Y-04 | `SIS:22/34` | «Objetos de sistema» / «System items» | REESCRIBIR | «Ítems» | «Items» |
| Y-05 | `SIS:24/36` | clave `descriptionLabel` sin uso | BORRAR | — | — |
| Y-06 | `SIS:62`, `:82` | conteos «1» sin etiqueta | BORRAR | — | — |
| Y-07 | `SIS:69` | eyebrow con el enum `training_charger` o el literal `'item'` | BORRAR (sin entrada de diccionario, se omite) | — | — |
| Y-08 | `SIS:72` | descripción en inglés en la página `es` | MARCAR `lang="en"` | — | — |
| Y-09 | `SIS:89` | eyebrow con `move.modo` o el literal `'move'` | BORRAR: los ataques salen del índice y pasan a «Ataques» de la ficha (§8.3) | — | — |
| Y-10 | `SIS:95`, `:101`, `:107` | `dt` con la clase `eyebrow` | REESCRIBIR como columnas de «Ataques» de la ficha (§8.3) | «Slot», «Cooldown», «Elemento» | «Slot», «Cooldown», «Element» |
| Y-11 | `SIS:94-111` | fragmentos vacíos | BORRAR | — | — |

Se conservan: `SIS:18/30` h1 «Sistemas» / «Systems»; `SIS:109` «{n} s».

### 12.11 Tier list, antes Rotaciones (`ROT`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| T-01 | `ROT:19/29`, `:49` | eyebrow «Wiki Core / Rotaciones» | BORRAR | — | — |
| T-02 | `ROT:20/30`, `:51` | intro «Dónde aparece cada categoría…» | BORRAR | — | — |
| T-03 | `ROT:58`, `:63`, `:69`, `:74` | título, disponibilidad, condición y lista en inglés en la página `es` | MARCAR `lang="en"` | — | — |
| T-04 | `ROT:24/34`, `:77-82` | «Conjunto comparado» (describe el modelo de datos) | BORRAR | — | — |
| T-05 | `ROT:21-23/31-33`, `:61`, `:68`, `:72` | etiquetas con la clase `eyebrow` | REESCRIBIR como líneas de dato con dos puntos (§8.8); «Disponibilidad» se borra, porque el texto es el párrafo | «Condición», «No aparece en» | «Condition», «Not found in» |

El h1 `ROT:17/27` pasa a «Tier list» (§8.8, E1).

### 12.12 Herramientas (`TI`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| TI-01 | `TI:16-17/43-44` | «Utilidades integradas en la wiki…» | REESCRIBIR según §13.5 | — | — |
| TI-02 | `TI:18/45`, `:82` | intro «Las herramientas forman parte del Codex.» | BORRAR | — | — |
| TI-03 | `TI:80` | eyebrow «Sección del Codex» (oculto por CSS) | BORRAR | — | — |
| TI-04 | `TI:19/46`, `:87` | h2 «Disponible» | BORRAR | — | — |
| TI-05 | `TI:21-22/48-49`, `:89-97` | tarjeta «Búsqueda del Codex» (la búsqueda no es una herramienta) | BORRAR | — | — |
| TI-06 | `TI:23-24/50-51` | «Mapa interactivo» y su descripción | REESCRIBIR el nombre; la descripción se borra mientras el mapa sea un marcador de posición (A11) | «Mapa» | «Map» |
| TI-07 | `TI:25/52`, `:102`; `TI:28/55`, `:107`; `TI:32/59`, `:112` | badges «Preview disponible», «Disponible», «Disponible en local» | BORRAR | — | — |
| TI-08 | `TI:26-27/53-54` | «Comparar Pokémon y tiers» y «…filtra el roster por tier, función y elementos.» | BORRAR del índice: «Comparar Pokémon» está en el grupo Pokémon (§8.0.3) | — | — |
| TI-09 | `TI:29-31/56-58` | «Ranking de guild» y «Carga el JSON del cliente, calcula el ritmo semanal…» | REESCRIBIR el nombre; la descripción se borra (plantilla D sin descripciones, §8.0.2) | «Guild» | «Guild» |
| TI-10 | `TI:20/47`, `:33-39/60-65`, `:117-138` | sección «Siguiente en la hoja de ruta» con filas inertes y «Próximamente» | BORRAR | — | — |

### 12.13 Comparar Pokémon (`TPK`, `EXP`, `ROS`): no pueden reaparecer

§11 rehace la herramienta desde cero. Se borran `EXP` completo y el encabezado de `TPK`. Ninguna de estas cadenas o patrones puede aparecer en la versión nueva:

- **Encabezado:** eyebrow «Herramientas / Pokémon» (`TPK:18/26`, `:46`) e intro «Lee dos variantes en paralelo o filtra el roster…» (`TPK:19/27`, `:48`).
- **Meta, proceso y valores internos:**
  - «Comparación directa» (`EXP:23/56`) y «Elige dos variantes» (`EXP:24/57`);
  - «…no calcula daño ni decide cuál Pokémon es mejor.» (`EXP:25-26/58-59`) y «Filtrar opciones» (`EXP:27/60`);
  - «Resumen comparado» usado a la vez como `caption` y como región (`EXP:31/64`, `:291`, `:295`) y la cabecera «Campo» (`EXP:32/65`);
  - la fila «Variante» (`EXP:34/67`) y «Nivel mostrado» / «Displayed level» (`EXP:36/69`);
  - «Elementos» con claves en minúscula «grass · poison» (`EXP:39/72`; `ROS:33-35`);
  - eyebrow «Pokédex» (`EXP:40/73`), «Explorar por tier» (`EXP:41/74`) y la promesa de un filtro de tipo que no existe (`EXP:42/75`, `:44/77`).
- **Controles defectuosos:**
  - 910 botones «Usar en comparar» con el mismo nombre accesible (`EXP:51/84`);
  - opción «001 - Shiny Bulbasaur · Shiny» (`EXP:102`) y opción «—» en el filtro de rol (`EXP:350`);
  - `tablist` nombrado como una de sus pestañas (`EXP:208`) y pestañas deshabilitadas antes de hidratar (`EXP:213`, `:224`);
  - 910 filas en `div role="list"` (`EXP:371-373`).
- **Regla que sí hereda §11:** los campos de Pokémon usan las etiquetas de la ficha (D-09): «Requisito», «Tier», «Elementos», «Rol», «Generación».

### 12.14 Guild (`GA`, `GRT`, `GWC`, `GPP`, `GS`, `GR`, `IMG`)

§10 rediseña Guild con analítica de administración. Las filas marcadas **B** (borrar) no pueden reaparecer. Las marcadas **R** (reescribir) dan el texto final de los mensajes que la herramienta nueva conserva; donde §10 fija un texto, manda §10.

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| G-01 | `GA:21/30`, `:48`; `GA:22-23/31`, `:50` | eyebrow «Herramientas / Guild» e intro «Importa cortes diarios; el ranking ajusta…» | B | — | — |
| G-02 | `GRT:196-199/374-377` | `eyebrow`, `title`, `intro` sin uso («Herramienta de comunidad»…) | B | — | — |
| G-03 | `GRT:205/383` | placeholder `{ "members": [...], "guild": "..." }` | B | — | — |
| G-04 | `GRT:209-210/387-388`, `:244/422` | «Se guardan automáticamente en este navegador. Vacío significa…», «Vacío = desactivada» | R | «Deja un campo vacío para no evaluar esa meta.» | «Leave a field empty to skip that goal.» |
| G-05 | `GRT:229-230/407-408` | «…El JSON no conserva la hora de cada task, por eso…» (explica el mecanismo) | R | «Reparte las dailies del día entre las dificultades; la suma debe igualar el total.» | «Split the day's dailies across difficulties; they must add up to the total.» |
| G-06 | `GRT:249-251/427-429` | «Zona horaria del export», «Se usa cuando exportedAt no trae offset horario.», «Server Save BR» | B: sin selector de zona horaria (A12, §10.10) | — | — |
| G-07 | `GRT:256-257/434-435` | «Cálculo añadido al historial.», «Cálculo actualizado. Se recalcularon los deltas…» | B: el aviso de importación es el de §10.10 | — | — |
| G-08 | `GRT:258-259/436-437`, `:305-307/483-485`, `:319-330/497-508`, `:355-356/533-534`, `:358/536`, `:361-362/539-540` | «Registro listo para…», «Histórico cargado», «Vista previa pendiente», «Pendiente de confirmar», bloques de ayuda de cálculo y de histórico («Las cifras usan únicamente los snapshots cargados…»), «Sin cambio de nivel», «Dailies y donación habilitadas», «Miembro previo al histórico» | B | — | — |
| G-09 | `GRT:262/440` | «Día de control» | R | «Día» | «Day» |
| G-10 | `GRT:267/445`, `:360/538`; `IMG:85/104` | «Donación total», «Donación desde», «DONACIÓN» / «DONATION» | R («Donación» no se usa en Guild) | «Contribución total», «Contribución desde», «Contribución:» | «Total contribution», «Contribution from», «Contribution:» |
| G-11 | `GRT:269/447` | «Premium» como estado (parece una cuenta) | R | «Meta premium» | «Premium goal» |
| G-12 | `GRT:289/467`, `:291-293/469-471` | «miembros visibles»; «Exportar datos» solo como texto oculto de un botón de descarga que abre acciones de copia, con su descripción | B: las salidas son «Exportar PNG» y «Exportar CSV» (§10.12, A10) | — | — |
| G-13 | `GRT:297-299/475-477` | «Resumen en español copiado para WhatsApp.», «Anuncio Markdown copiado para Discord. Se separa en bloques si hace falta.», «Imagen PNG generada con la contribución incluida.» | B las copias para WhatsApp y Discord (A10, §10.14); R el aviso del PNG | «Imagen descargada.» | «Image downloaded.» |
| G-14 | `GRT:300-301/478-479` | «Todavía no hay una guild cargada», «…o pégalo en el campo anterior.» (no hay campo anterior) | R (estado vacío con acción del sistema de diseño; respuesta Q2) | «Importa un export de guild para ver el análisis.» + botón «Importar»; ayuda «Exporta desde la ventana de guild del juego (Ctrl+J).» | «Import a guild export to see the analysis.» + «Import»; «Export it from the in-game guild window (Ctrl+J).» |
| G-15 | `GRT:302/480` | «Historial de snapshots» | R como la sección de §10.10 | «Cortes» | «Snapshots» |
| G-16 | `GRT:316-318/494-496` | «Base de semana», «Delta calculado», «Disminución detectada» | R la primera y la tercera; B «Delta calculado» | «Primer corte de la semana», «Total menor que el anterior» | «First snapshot of the week», «Lower than previous total» |
| G-17 | `GRT:343-354/521-532` | descripción de actividad, «Bajas observadas», «No hay movimientos de miembros en los snapshots…», «Alta observada», «Reingreso observado», «Baja observada», «Detectado al comparar snapshots» | B: la lista de altas y bajas sale (§10.14, E7) | — | — |
| G-18 | `GRT:357/535` | «Progreso y acceso» | R como el dato del diálogo del miembro (§10.9) | «Semana» | «Week» |
| G-19 | `GRT:365-367/543-545`, `:370/548` | errores de importación que nombran claves («…una lista members válida», «…nombre normalizado») | R | «El contenido no es un JSON válido.»; «El archivo no es un export de guild válido.»; «Hay dos miembros con el mismo nombre.» | «This file isn't valid JSON.»; «This file isn't a valid guild export.»; «Two members share the same name.» |
| G-20 | `GRT:651` | nombre de archivo «Historial del navegador» / «Browser history» | R | «Corte del {fecha}» | «{date} snapshot» |
| G-21 | `GRT:690` | «El navegador no pudo guardar más historial local.» | R | «No hay espacio para guardar más historial en este navegador.» | «There's no space to save more history in this browser.» |
| G-22 | `GRT:1175`; `GRT:1341`; `GRT:1343`; `GRT:1354-1365`; `GRT:1441` | aviso «Viendo el registro del…» (duplica el banner de `:1413-1415`); eyebrow «Clasificación»; badge «{n} miembros»; contextos «Cobertura» y «Guardado: Navegador · Sin conexión»; zona IANA visible | B (el estado sin conexión queda en la hoja de cuenta, `GRT:1845`) | — | — |
| G-23 | `GRT:1418` | «Return to latest» | B: la vista histórica sale (§10.14) | — | — |
| G-24 | `GRT:1534`, `:2071`; `GR:576-598` | rangos en portugués «Membro», «Vice-Líder», «Líder» | R con los términos del cliente, iguales en los dos idiomas (tablero Guild: «Leader y Vice-Leader») | «Leader», «Vice-Leader», «Member» | «Leader», «Vice-Leader», «Member» |
| G-25 | `GRT:1534`, `:1541`, `:1720`; `IMG:79/98` | «Lv.», «pts.», «dailies», «pts totales» escritos en línea | MOVER al diccionario | «Lv.», «pts», «dailies», «pts totales» | «Lv.», «pts», «dailies», «total pts» |
| G-26 | `GRT:1611-1613` | «Cambios observados en los cortes de la semana.» | B | — | — |
| G-27 | `GRT:981`, `:1680` | «1 registro · 1 semana · 1 mes» | R con plurales | «1 corte» / «{n} cortes» | «1 snapshot» / «{n} snapshots» |
| G-28 | `GRT:1686-1688` | «…días sin corte entre los registros guardados.» | R (un solo término: «corte») | «{n} días sin corte entre los cortes guardados.» | «{n} days without a snapshot between saved snapshots.» |
| G-29 | `GRT:1736`, `:1828-1829` | «Ver JSON», «JSON · {fecha}», «JSON local» (volcado para desarrolladores) | B (A10, a criterio del equipo) | — | — |
| G-30 | `GRT:1743`, `:1784` | «Aún no hay cortes guardados.» (inalcanzable) y «Uno o varios archivos JSON» | B | — | — |
| G-31 | `GRT:1845-1849` | «Sincroniza el historial con tu guild.» | R (solo sin sesión) | «Inicia sesión para guardar el historial de tu guild y abrirlo en otros dispositivos.» | «Sign in to save your guild history and open it on other devices.» |
| G-32 | `GRT:1876-1877` | «Metas prorrateadas según los días habilitados.» | R | «Las metas se ajustan a los días en que cada miembro pudo participar.» | «Goals are prorated to the days each member could take part.» |
| G-33 | `GRT:1955` | «350–∞» | R | «350+» | «350+» |
| G-34 | `GRT:1963`, `:1968` | `aria-label` con la clave interna «normal · Puntos por daily» y `<small>` repetido tres veces | R: encabezado de columna único y nombres del juego | «Puntos por daily»; «Normal · Puntos por daily», «Wildscape · …», «Primal · …» | «Points per daily»; «Normal · Points per daily», … |
| G-35 | `GRT:2035-2036`, `:2041-2043` | «{n} campo inválido» y «Sin cambios» (falso si cambió Cálculo) | R con plurales, con el texto de §10.11; B «Sin cambios» | «1 campo no válido» / «{n} campos no válidos» | «1 invalid field» / «{n} invalid fields» |
| G-36 | `GRT:2096` | h3 «Evaluación» | R | «Meta semanal» | «Weekly goal» |
| G-37 | `GRT:2206-2208` | «Este corte no tiene un intervalo de dailies para corregir.» | R | «Este corte no tiene dailies para desglosar.» | «This snapshot has no dailies to split.» |
| G-38 | `GWC:32`, `:35` | eyebrow y badge de miembros de la cabecera | B (y sus props) | — | — |
| G-39 | `GPP:29/65`, `:30/66`, `:314-319` | eyebrow «Cuenta y archivo», h2 «Cuenta y respaldo» y estado «Supabase» / «Local» / «Sesión activa» (bloque oculto por `w:3783-3785`) | B | — | — |
| G-40 | `GPP:31-32/67-68` | «…El servidor conserva un export por fecha de Server Save…» | B | — | — |
| G-41 | `GPP:33/69` | «La conexión con Supabase todavía no está configurada en este entorno.» | R | «La sincronización no está disponible ahora. Tu historial sigue guardado en este navegador.» | «Sync is unavailable right now. Your history is still saved in this browser.» |
| G-42 | `GPP:36-38/72-74`, `:399-434` | pestañas «Acceso» / «Registro» que controlan el mismo formulario | R con el `ToggleGroup` de «Acceso» de §9.9 | «Entrar», «Crear cuenta» | «Sign in», «Create account» |
| G-43 | `GPP:47/83`, `:48/84`, `:49/85`, `:50/86` | «Crear y seleccionar», «Guardar este export», «Carga un JSON válido para habilitar el guardado.», «Crea o selecciona una guild para guardar el export.» | R «Crear guild» (§10.4); el resto se borra, porque importar ya guarda (§10.10) | «Crear guild» | «Create guild» |
| G-44 | `GPP:52-54/88-90`, `:303-306` | «Export guardado: 2026-09-10. El export de ese día fue reemplazado y quedó registrado en el historial.» (fecha ISO) | B: el aviso de importación es el de §10.10 | — | — |
| G-45 | `GPP:55-56/91-92` | «…Si Supabase solicita confirmación, revisa tu correo…» | R | «Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.» | «Account created. Check your email to confirm it before signing in.» |
| G-46 | `GPP:175`, `:229`, `:242` | `error.message` crudo de Supabase (en inglés) | R con la tabla de errores de §12.14.1 | — | — |
| G-47 | `GPP:364`; `GPP:372`, `:384`, `:459` | placeholder «Family One»; espera «…» | B el placeholder; R las esperas | «Creando…», «Guardando…», «Entrando…» | «Creating…», «Saving…», «Signing in…» |
| G-48 | `GS:152`, `:160` | «El JSON necesita exportedAt para poder asociarse a un día de Server Save.» y «El valor de exportedAt no tiene un formato…» (solo español, nombran la clave) | R | «El archivo no tiene fecha de exportación.»; «La fecha de exportación del archivo no es válida.» | «This file has no export date.»; «This file's export date isn't valid.» |
| G-49 | `GR:565`, `:569`, `:900-922` | `formatGuildNumber` y `formatGuildExportDate` con `'pt-BR'` por defecto («1.300» en `en`); `formatGuildGoalSet` con `es-ES`/`pt-BR` | R: `locale` obligatorio y formatos de §13.3 | «1.300» | «1,300» |
| G-50 | `IMG:83-86/102-105`, `:215-216`, `:91/110`, `:127`, `:137` | etiquetas en mayúsculas «META HOY», «DAILIES», «PREMIUM», «NOMBRE», «CARGO»; pie «…· contribución separada de puntos»; respaldo «Guild ranking» en `es`; «Semana 2026-09-07 → 2026-09-13 · día 4/7 · zona America/Sao_Paulo» | R (§10.12) | «Meta hoy:», «Dailies:», «Meta premium:»; «Nombre», «Rango»; pie «Alliance Codex · Guild»; respaldo «Guild»; «Semana: 07/09 a 13/09, día 4 de 7» | «Today's goal:», «Dailies:», «Premium goal:»; «Name», «Rank»; «Alliance Codex · Guild»; «Guild»; «Week: Sep 7 – 13, day 4 of 7» |

#### 12.14.1 Errores de cuenta y de datos remotos

`mapSupabaseError(error, locale)` decide por `error.code` o por el tipo de error, nunca por el texto. Lo usan Guild y las cuentas de Comercio (§9).

| Código | es | en |
|---|---|---|
| `invalid_credentials` | «Correo o contraseña incorrectos.» | «Wrong email or password.» |
| `user_already_exists` | «Ya existe una cuenta con ese correo.» | «An account with that email already exists.» |
| `weak_password` | «La contraseña es demasiado corta.» | «The password is too short.» |
| `email_not_confirmed` | «Confirma tu correo antes de iniciar sesión.» | «Confirm your email before signing in.» |
| `over_email_send_rate_limit`, `over_request_rate_limit` | «Demasiados intentos. Espera un momento.» | «Too many attempts. Please wait a moment.» |
| `42501`, `PGRST301` | «Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.» | «Your session expired or you lack permission. Sign in again.» |
| `23505` al crear guild | «Ya existe una guild con ese nombre.» | «A guild with that name already exists.» |
| `TypeError` de red | «Sin conexión con el servidor.» | «Can't reach the server.» |
| cualquier otro | «No se pudo completar la operación.» | «The operation could not be completed.» |

### 12.15 Mapa (`MI`, `ME`, `CM`)

El mapa interactivo queda para después (A11): `/{l}/mapa/` es un marcador de posición cuyo contenido fija §8, sujeto a G1–G14 y con `noindex` (§13.5). El explorador actual sale del sitio publicado y con él estas cadenas, que no pueden reaparecer en el marcador:

- **Encabezado:**
  - descripción «Mapa interactivo de PokeAlliance…» (`MI:18/26`);
  - eyebrow «Herramientas / Mapa» (`MI:19/27`, `:47`) e intro «Explora los marcadores por piso…» (`MI:20/28`, `:49`);
  - enlace «Aportar al mapa · Formato para enviar un punto nuevo o una corrección. →» (`MI:21-22/29-30`, `:50-53`);
  - `aria-label` que repite el h1 (`MI:55`).
- **Explorador:**
  - placeholder «Pokémon Center, Poke Mart…», con una grafía que la propia búsqueda no encuentra (`ME:32/56`);
  - «Marcadores disponibles» (`ME:34/58`) y «Sin etiqueta» (`ME:38/62`);
  - «Marcador sin etiqueta», en español también en `en` (`CM:44`);
  - «Otro marcador» (`ME:39/63`), «Capas» (`ME:40/64`), «visibles» / «ocultos» (`ME:42-43/66-67`);
  - «Arrastra el mapa para explorar» (`ME:48/72`), «Mapa base» y «Mapa base no disponible» (`ME:49-50/73-74`);
  - etiquetas de ejes «x …–…», «y …–…» (`ME:338-341`) y `title` duplicados en los marcadores (`ME:351`);
  - glifo «◎» como botón (`ME:378`) y botones ↑/↓ de piso con nombre erróneo (`ME:401-424`);
  - fila `flagId` (`ME:463-464`), el panel entero como `aria-live` (`ME:437`) y `aria-label` en `div` sin rol (`ME:224`, `:248`, `:270`, `:361`, `:401`).

### 12.16 Comercio (`COM`, `TD`, `DR`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| M-01 | `COM:29-30/36-37` | «Prepara un anuncio… para comercio comunitario.» | REESCRIBIR según §13.5 | — | — |
| M-02 | `COM:31-32/38`, `:56` | «Prepara los datos… Los anuncios públicos aún no están habilitados.» | BORRAR | — | — |
| M-03 | `COM:54` | kicker «Comunidad» (la miga ya dice «Comunidad / Comercio») | BORRAR | — | — |
| M-04 | `COM:58-60` | mosaico decorativo con la Alliance Ball, con forma de botón | BORRAR | — | — |
| M-05 | `TD:125/182` | aviso RMT a 10 px «El RMT se anuncia fuera de los canales oficiales…» | REEMPLAZAR por el `InfoBanner` de Comercio (§9.5.1, E6) | el de §9.5.1 | el de §9.5.1 |

§9 sustituye el compositor `TD` por el mercado. No pueden reaparecer:

- **Proceso y meta:**
  - «Busca en las 910 variantes del roster» (`TD:86/143`);
  - «Completa sólo los valores que puedas comprobar en el cliente.» (`TD:91/148`) y «Uno por defecto; hasta seis.» (`TD:95/152`);
  - «Se compone en este navegador; aún no se publica ni guarda.» (`TD:111/168`) y «Borrador local» / «Local draft» (`TD:124/181`);
  - «Datos declarados para esta unidad» (`TD:117/174`), «Cantidad exacta» (`TD:118/175`) y «Forma corta» (`TD:119/176`);
  - la clave `empty` sin uso (`TD:112/169`).
- **Etiquetas mal escritas del juego** (§9.7.2 usa la forma de la derecha):
  - «Training skills» en `es` (`TD:90/147`) → «Entrenamiento»;
  - «Slots totales» / «Total slots» (`TD:93/150`) → «Memory Slots»;
  - «Star level» (`TD:98/155`) → «Star Level»;
  - «Next boost chance (%)» (`TD:105/162`) → «Next Boost chance (%)».
- **Precio y validación:**
  - «Precio pedido» / «Asking price», falso al comprar (`TD:106/163`) → «Precio» / «Price»;
  - «Revisa los valores de nivel, boost, stars, chance, training o memorias.» (`TD:116/173`): cada campo inválido lleva su propio mensaje (§9.7.5).
- **Moneda:** el código interno `'KK'` (`TD:198`; `DR:5`) nunca es visible. En pantalla, la forma corta «solo si es exacta» de `DR:23` se sustituye por el formato redondeado del sistema de diseño (§4.3); el texto copiado de §9.7.7 la conserva (E12).

### 12.17 Componentes base (`src/components/ui/*`)

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| U-01 | `ui/dialog.tsx:63`, `:96`; `ui/sheet.tsx:68` | texto oculto «Close» fijo en inglés | REESCRIBIR como prop obligatoria `closeLabel` | «Cerrar» | «Close» |
| U-02 | `ui/kbd.tsx:8` | `text-[10px]` (por debajo del piso de 12 px) | REESCRIBIR al estilo `kbd` del sistema de diseño (12/22 mono) | — | — |
| U-03 | `ui/dialog.tsx:29`; `ui/sheet.tsx:31` | velo `bg-black/10` con `backdrop-blur-xs` | REESCRIBIR con el token `overlay` (`#000000cc`, blur de 4 px, permitido por el sistema de diseño) | — | — |

### 12.18 `src/lib/content` y valores de datos que llegan a la pantalla

| ID | Archivo:línea | Actual | Acción | Texto final es | Texto final en |
|---|---|---|---|---|---|
| L-01 | `REPO:105` | colección `items` «Objetos» | REESCRIBIR | «Ítems» | «Items» |
| L-02 | `REPO:156-169` | meta de búsqueda con `variante`, `modo` y `tipo` crudos | REESCRIBIR por diccionario; sin entrada se omite (B-12) | — | — |
| L-03 | `content/system-items.json` (`tipo: "training_charger"`), `content/rotations.json` (`tipo: "availability_scope"`) | enums internos | CONSERVAR en los datos; nunca se muestran (G4) | — | — |
| L-04 | `content/quests.json`, `content/rotations.json`, `content/system-items.json`, `content/locations.json` | frases en inglés | MARCAR `lang="en"` en páginas `es`; su traducción queda fuera (§15) | — | — |
| L-05 | `FMT:6`, `:11` | `formatTier` y `formatList` devuelven «—» sin valor | CONSERVAR para tarjetas y tablas (regla G7); dentro del tooltip la fila se omite antes de llamar al formateador | — | — |
| L-06 | `src/lib/content/registry.ts:25`, `:38-40`; `registry-schema.ts:79-138` | bandera `borrador` | CONSERVAR (D-011). Nunca se muestra como texto; la visibilidad la controla `OCULTAR_BORRADORES` | — | — |

Los mensajes de validación de `registry-schema.ts:60`, `:144-156` son para quien edita los JSON en el build; no llegan a la interfaz y quedan fuera del barrido.

### 12.19 Procedencia: resultado del barrido

- **Búsqueda.** El 2026-09-19 se buscaron en `src/` y en `content/` los términos `provenance`, `procedencia`, `fuente`, `evidenc`, `verificad`, `verified`, `confian`, `confidence`, `obtenid`, `claim`, `sources` y `sourceType`. Resultado: **0 apariciones visibles**. `confidence` en `GRT:810-826` es el estado del desglose de dificultad (estimado, exacto o manual), no procedencia.
- **Residuo técnico.** `GS:179-188` reintenta con una etiqueta fija `LEGACY_SOURCE_LOCATOR` mientras la migración `supabase/migrations/20260918220000_remove_provenance.sql` no esté aplicada. No es visible. Se borra cuando el propietario autorice aplicar esa migración (§15).
- **Regla hacia adelante:**
  - ningún esquema de `content/schemas/` acepta campos de fuente, evidencia, verificación o fecha de obtención;
  - `pnpm content:check` falla si aparecen las claves `fuente`, `fuentes`, `source`, `sources`, `evidencia`, `verificado`, `verificadoEl` u `obtenidoEl` en cualquier registro;
  - el centinela de §12.22 cubre la interfaz.

### 12.20 Controles falsos y UI muerta: §9 de v1 revisado contra el árbol del 2026-09-19

Estados:

- **vigente:** el defecto sigue y v2 lo cierra como indica la fila;
- **cerrado:** ya no existe;
- **superado:** el archivo se rehace (§8–§11) y la regla pasa a ser criterio de aceptación de esa sección;
- **fuera:** va con el mapa interactivo (§15).

| v1 | Estado | Dónde hoy | Cierre en v2 |
|---|---|---|---|
| 1 | vigente | `BUS:29`, `:48`; `CS:49-50` | La consulta `q` se lee en el cliente con `location.search`; cada cambio escribe la URL con `replaceState`. Prueba: `prod.spec.ts` abre `/es/buscar/?q=bulba` con el campo lleno. |
| 2 | vigente | `CS:85`, `:94` | Ningún control sale deshabilitado del HTML a la espera de hidratar. |
| 3 | vigente | `IDX:52`; `GRID:92`, `:159-165` | Los filtros, la vista y la página de la Pokédex viven en la URL; al montar se leen de `location.search`. Prueba: recargar `/es/pokedex/?elemento=fire&variante=shiny` conserva los filtros. |
| 4 | vigente | `AL:143-158` | Se borran los iconos; botón de tema según X2 y PZ-01. |
| 5 | vigente | `AL:135`, `:141`, `:99-100` | Selector de idioma de S-16 y `hreflang` de §13.5. |
| 6 | vigente | `WS:44` | El keycap solo lo lleva `SearchTrigger`, que atiende Ctrl/Cmd + K (PZ-02). |
| 7 | vigente | `CS:94-97` | Se borra el botón. |
| 8 | vigente | `HOME:20`; `SSS:12-16` | Se borra el panel (H-11). Si la respuesta a Q7 lo reubica, se calcula en el cliente y el HTML prerenderizado solo lleva la hora canónica. |
| 9 | vigente | `AL:117-130` con `HOME:99-104`; `WS:33`, `:37` | El Inicio no lleva buscador en la cabecera (regla de `Header`); un solo `role="search"` por página. |
| 10 | vigente | `w:214-218` | Por debajo de 768 px, lupa de 44 px en la cabecera (`SearchTrigger` `icon`). |
| 11 | vigente | `ROOT:4`; `.vercel/output/config.json` | R-01 y R-02. |
| 12 | cerrado | — | `DET` ya no tiene la sección «Datos de la ficha». |
| 13 | vigente | `GRID:277` | P-16. |
| 14 | vigente | `GRID:280-284`, `:351-353` | P-18. |
| 15 | vigente | `GRID:316`; `DET:99` | Ningún elemento lleva `view-transition-name` (T4, §6.1). |
| 16 | vigente | `GRID:308`; `DET:91` | P-22. |
| 17 | vigente | `DET:116-131` | D-10: la sección sale; en la sección «Tier list» de §8.3, la fila actual lleva `aria-current="page"`, en negrita y sin enlace. |
| 18 | vigente | `OUT:198-200`, `:285-289` | D-12, con estados separados `imageError` y `auraError`. |
| 19 | cerrado | — | A9 rechazada: Premier está verificada (Q4) y la opción ya no lleva «prueba». |
| 20 | vigente | `OUT:256-267` | D-15. |
| 21 | vigente | `DET:161` | D-03. |
| 22 | vigente | `DET:23` | D-02. |
| 23–25 | superado | `EXP` | §11: un nombre accesible distinto por botón, pestañas reales (`role="tab"`, `aria-controls`, flechas) o ninguna, tabla semántica con `th scope`, paginación en lugar de 910 filas. |
| 26 | vigente | `IDX:67-69`, `:81` | P-05. |
| 27 | vigente | `GRID:307`; `DET:90` | P-22. |
| 28 | vigente | `HOME:108`, `:115`, `:150` | H-06, H-07, H-09. |
| 29 | parcial | `AL:74-79`; `MI:50-53` | «Aportar» se retira (S-10, R-03). «Cambios» se queda (A2 rechazada) con el estado vacío C-05. |
| 30 | vigente | `GUI:125-127` | Q-09. Cuando exista la ubicación en el mapa interactivo, habrá un enlace real «Ver en el mapa» / «View on map» (§15). |
| 31 | vigente | `GUI:137`, `:143` | Q-12. |
| 32 | vigente | `GUI:79-84` | Q-06. |
| 33 | vigente | `GUI:63`, `:119`; `SIS:62`, `:82` | Q-02, Y-06. |
| 34 | vigente (código) | `SIS:94-111`; `HOME:145-148`; `DET:152-155`, `:165-168`; `AP:117-120` | Se borran con la reescritura de cada archivo. |
| 35 | vigente | `TI:117-138` | TI-10. |
| 36 | superado | `GRT:1025-1028`, `:2041-2043` | §10: Guardar y Cancelar cubren metas y cálculo; Cancelar revierte los dos. |
| 37 | superado | `GRT:1795-1807` | §10: sin selector de zona horaria; un `exportedAt` sin zona se interpreta en `America/Sao_Paulo` (A12, §10.10). |
| 38 | superado | `GRT:1570-1581` | §10: sin botón «⋯» que repite la acción del nombre. |
| 39 | superado | `GRT:1727-1737`, `:1825-1833` | G-29. |
| 40 | superado | `GRT:1743` | G-30. |
| 41 | superado | CSS del badge premium en conflicto | Un solo estilo desde los tokens (`Chip`). |
| 42 | superado | `GRT:1500` | Las flechas de orden son `aria-hidden`; el estado lo da `aria-sort`. |
| 43 | superado | CSS que oculta columnas por debajo de 1200 px | §10: ninguna columna ordenable desaparece; la tabla se desplaza en su contenedor (DS `DataTable`). |
| 44 | vigente | `IMG:250` frente a `GRT:915` | El PNG y la interfaz calculan la banda con el mismo `goalPacing` (§10.12). |
| 45 | superado | CSS de Guild | §10 con la anatomía del tablero Guild. |
| 46 | superado | `GPP:399-434` | G-42. |
| 47 | superado | `GRT:291/469` | G-12. |
| 48 | superado | `GRT:1401-1408`; `GPP:465-466` | Una región viva persistente por superficie (`Notice` con `role="status"`) que solo cambia su texto. |
| 49–58 | fuera | `ME` | Criterios de aceptación del corte del mapa (§15): pisos con el piso 7 como superficie (Q1), marcadores de 24 × 24 como botones, teclado completo, sin decoración de ejes, búsqueda normalizada con NFD. |
| 59–69 | superado | `TD`, `COM` | §9. Hereda: sin slot de ball estático; validación tras la primera interacción; `aria-invalid` y mensaje enlazado por campo; la vista previa no es `aria-live`; grupos de opción única con semántica de `ToggleGroup`. Los puntos 61 y 62 ya estaban cerrados. |
| 70 | vigente | `AL:15-28`, `:48-79` | S-04. |
| 71 | vigente | `AL:232-246` | S-21. |
| 72 | revertido | `ui/dialog.tsx:29`; `ui/sheet.tsx:31` | El sistema de diseño aprueba el velo con blur de 4 px (token `overlay`): U-03. |
| 73 | superado | `GRID:177-284` | `FilterBar` del sistema de diseño; la maqueta de 390 px la fija §8. |
| 74 | vigente | `DET:98`; `HOME:122`; `GUI:82` | D-08. |
| 75 | vigente | `AL:45`, `:106`, `:108`; `AW:3` | S-03, S-14. |
| 76 | vigente | eyebrows ocultos por `w:512-514` (`BUS:43`, `CAM:41`, `SIS:54`, `ROT:49`, `TI:80`, `TPK:46`, `GA:48`, `MI:47`, `AP:92`); bloque `GPP:312-320` oculto por `w:3783-3785` | Se borra el marcado; la hoja `wiki-reference.css` se sustituye entera (§3.10). |
| 77 | superado | `GRID:357-368` | P-28: `Pagination` con enlaces `<a href>` que funcionan sin JS. La forma de la URL la fija §7.7.2. |
| 78 | superado | `GRT:1911-1913` | §10: cada campo inválido tiene su mensaje enlazado con `aria-describedby`. |

### 12.21 Piezas del diseño aprobado que deben funcionar o no mostrarse

Los tableros usan datos de ejemplo y algunos controles sin acción. Nada de eso se copia tal cual.

| ID | Pieza del tablero | Regla | Mientras tanto |
|---|---|---|---|
| PZ-01 | Botón de tema «Cambiar a tema claro» (`Header`, todos los tableros) | `tokens.json` define un solo tema («Oscuro»): el botón no haría nada (G8). Solo se muestra si existe un segundo tema completo. | No se renderiza (X2); en §14.5 su caja se enmascara (desviación DV1). Pregunta abierta Q6. |
| PZ-02 | Keycap «Ctrl + K» | Solo en el `SearchTrigger` visible; Ctrl + K y Cmd + K abren la paleta; no se muestra en teléfono. | — |
| PZ-03 | Chevron del selector de idioma | Abre la lista de dos idiomas (`aria-expanded`); cada opción navega a la misma ruta en el otro idioma. | — |
| PZ-04 | Enlaces del menú lateral (Tier list, Linked Tasks, Medal System, GamePass, Achievements, Prey, Experiencia y Level, categorías de ítems, actividades…) y conteos «10 páginas» | Solo se enlazan rutas que existen en el build. Un grupo sin rutas no se muestra. Cada conteo de `IndexPanel` es el número de enlaces que el panel pinta. «Aportar al mapa» no aparece (A1). | Desviación DV2 en §14.5. |
| PZ-05 | Columna «En línea» de la tabla «Mundos» del Inicio (1911, 1882…) | No hay fuente de población hasta `/api/mundos` (§15). Una columna sin ningún valor contradice G7. | La tabla lista los mundos de `content/mundos.json` solo con la columna «Mundo» (X3, §8.1); desviación DV3. |
| PZ-06 | «910 variantes…», «526 normales», «384 Shiny» | Se calculan de los datos del build. | — |
| PZ-07 | «Mantén Shift para fijar» | El fijado con Shift existe con las condiciones de la guía del tooltip; si un tooltip no se puede fijar, su franja no se muestra. | — |
| PZ-08 | «Publicar anuncio», vendedor «Kaiser 4.6 (23)», chips de contacto verificado | Solo con los flujos de §9: cuenta con correo y teléfono verificados, reseñas ligadas a una operación. El build de producción no incluye vendedores, reseñas ni anuncios de ejemplo: `tests/fixtures/comercio/*` solo se lee con `COMERCIO_DEMO=1`, que no existe en producción (§9.2, CA-9.1). | La fase A dice «Crear anuncio» (DV9). |
| PZ-09 | Cifras de Guild («23 de 25», «−8,4%», «Meta diaria: 10.536») | Se calculan de los exports que importa el usuario; ninguna viene del tablero. | — |
| PZ-10 | «HP: 1.700», «Experiencia: 54.000» en la ficha | Solo si `content/pokemon.json` tiene el campo; si no, la fila no aparece. | — |
| PZ-11 | «+N», secciones plegables «Held Items: 2», «Paginación» | Son controles reales: `aria-expanded` y `aria-controls`, y enlaces que navegan. | — |

### 12.22 Lista prohibida del centinela de contenido

La usan dos pruebas:

- `tests/i18n/forbidden.test.ts` revisa los valores de los diccionarios;
- `tests/e2e/content-sentinel.spec.ts` revisa el texto visible, `alt`, `title`, `aria-label`, `placeholder`, `<title>` y `meta[name=description]` de cada ruta de §14.4.

Reglas de comparación:

- Las cadenas se buscan como subcadena y sin distinguir mayúsculas, salvo donde se indica. Los patrones son expresiones regulares con las marcas que indica cada uno.
- Los textos de interfaz de las listas «Solo `es`» y «Solo `en`» marcados con (=) se comparan como nombre o nodo de texto completo, porque son palabras que pueden aparecer dentro de nombres del juego (p. ej. el movimiento «Close Combat»).
- En páginas `es`, lo que está dentro de `[lang="en"]` se ignora para la lista «Solo `es`».

- **Ambos idiomas, cadenas:** «Wiki Core», «Supabase», «Temporal» (con esa mayúscula), «America/Sao_Paulo», «America/Mexico_City», «flagId», «OTMM», «Minimap.flags», «availability_scope», «training_charger», «pending_review», «exportedAt», «manual-paste», «Family One», «Membro», «Vice-Líder», «roster», «snapshot OTMM», «Provenance», «Procedencia», «Fuente:», «Fuentes», «Source:», «Sources», «Verificado el», «Verified on», «Dato confirmado», «Según la hoja», «evidencia», «evidence», «Próximamente», «Coming soon», «hoja de ruta», «roadmap», «Preview disponible», «Disponible en local», «Borrador local», «Local draft», «Ctrl K» (sin «+»), «Lorem», «undefined», «NaN», «[object Object]», «Invalid Date».
- **Ambos idiomas, patrones:**
  - `\bKKs?\b`, `\bgold\b` y `\bTODO\b`, con mayúsculas y minúsculas exactas: «TODO» solo como palabra entera en mayúsculas, así no coinciden «Todo» (Ítems), «Todos», «Todas», «Todos ({n})» ni «Todos los ítems»;
  - `\bT(Legendary|Mythic|ULTIMATE|Super Rare|Ultra Rare)\b`;
  - `[↗✦]` y `\b\d+\s?px\b`.
- **Solo en los diccionarios** (`forbidden.test.ts`): emoji (`\p{Extended_Pictographic}`) y «!».
- **Solo en las rutas `es` de Comercio y de cuenta**, como palabra: «confiable», «seguro» y «garantizado» (§9.9).
- **Solo `es`:**
  - «Datos de la ficha», «Archivo de campo», «registros normalizados», «Delta calculado», «Training skills», «Cambiar a English», «Outfit del juego», «Precio NPC: aún no», «Objetos de sistema»;
  - textos de interfaz en inglés fuera de `[lang="en"]`: «Hold Shift to pin», «Search...», «Open menu», «Skip to content», «Breadcrumb» (=), «Close» (=).
- **Solo `en`:**
  - «Record data», «Local draft», «Field archive», «Game outfit», «normalized records», «Client map», «Switch to Español»;
  - los textos por defecto en español del sistema de diseño: «Mantén Shift para fijar», «Buscar...», «Cambiar a tema claro», «Abrir menú», «Cerrar menú», «Saltar al contenido», «Migas de pan», «Paginación» (=), «Idioma:», «Vista» (=), «Lista» (=), «Resumen» (=), «Cerrar aviso», «es un proyecto comunitario».

---

## 13. i18n, SEO, rendimiento y accesibilidad

### 13.1 Idiomas y rutas

- **Idiomas:** `es` (por defecto) y `en` (`CFG:1`). Toda página vive bajo `/es/…` o `/en/…` con la misma ruta relativa en los dos idiomas.
- **Raíz:** `/` responde **302** a `/es/` desde la configuración (R-01). No se detecta el idioma por `Accept-Language` (§15).
- **Cambio de idioma:** conserva ruta, consulta y ancla: `/es/pokedex/?elemento=fire#drops` ↔ `/en/pokedex/?elemento=fire#drops`. Lo resuelve `getAlternatePath(pathname, locale)` para el HTML prerenderizado; al hacer clic, `scripts/popover-anchor.ts` añade `location.search` y `location.hash` (§7.10.1). Sin JS, el enlace va a la misma ruta sin consulta.
- **Marcado:**
  - `<html lang="es">` o `<html lang="en">`;
  - las frases de datos en inglés dentro de páginas `es` llevan `lang="en"` (WCAG 3.1.2): resúmenes, pasos y recompensas de misiones, textos de rotaciones y descripciones de ítems;
  - los nombres propios y los términos del juego no llevan `lang` (§13.4);
  - la opción «English» del selector lleva `lang="en"` y «Español», `lang="es"`.
- **Rutas retiradas:** `/{l}/mapa/aportar/` → `/{l}/mapa/` (A1), `/{l}/rotaciones/` → `/{l}/pokedex/tiers/` (E1) y `/{l}/guias/` → `/{l}/actividades/` (E2), todas 302 (§8.0.1).

### 13.2 Diccionarios y claves

- **Archivos.**
  - `src/i18n/messages/es.ts` es la fuente: `export const es = {...} as const satisfies MessageTree`.
  - `src/i18n/messages/en.ts` exporta `en: Messages`, donde `Messages` es el mismo árbol con cada hoja como `string` o plural. TypeScript falla si falta o sobra una clave.
  - `src/i18n/config.ts` conserva `locales`, `isLocale`, `getLocale` y `getAlternateLocale`; `localeCopy` desaparece (S-23).
- **Espacios de nombres:** `ui`, `shell`, `home`, `search`, `pokedex`, `pokemon`, `tiers`, `items`, `systems`, `activities`, `changes`, `tools`, `compare`, `guild`, `trade`, `map`, `errors`, `format`, `seo`. `ui` es el espacio compartido de los componentes (DP1): franja del tooltip, vistas, paginación, cerrar, aviso y etiquetas de los constructores de tooltip (§7.5.3). Los nombres de los elementos no están en los diccionarios: salen de `content/elementos.json` (§8.0.5). Claves en camelCase inglés, como las actuales (`skipToContent`).
- **Valores serializables.**
  - Las hojas son `string` con marcadores `{nombre}` o plurales `{ one, other }`; nunca funciones, porque las props de las islas deben poder serializarse.
  - `fill(template, vars)` sustituye marcadores y falla en desarrollo si falta una variable.
  - `plural(locale, n, entry)` usa `Intl.PluralRules`.
- **Islas.** Una isla recibe solo `messages.ui` y el espacio de nombres de su página (`messages.pokedex`), del idioma de la página, como props; nunca el diccionario entero ni el otro idioma (presupuesto de §13.6).
- **Componentes del sistema de diseño.** Sus textos visibles son props (DP1). En el DS tienen valor por defecto en español (`ds/project/README.md`); en el sitio no se usa ese valor: quien compone pasa siempre el del diccionario, también en `es`, para que un cambio en el diccionario no dependa de los valores por defecto.
- **Claves mínimas del shell.** Las fijan S-13 a S-22 y los componentes del sistema de diseño:

| Clave | es | en |
|---|---|---|
| `shell.skipToContent` | «Saltar al contenido» | «Skip to content» |
| `shell.navLabel` | «Principal» | «Main» |
| `shell.searchHeader` / `shell.searchHome` / `shell.searchIcon` | «Buscar...» / «Busca Pokémon, ítems, sistemas…» / «Buscar» | «Search...» / «Search Pokémon, items, systems…» / «Search» |
| `shell.shortcut` | «Ctrl + K» | «Ctrl + K» |
| `shell.languageLabel` | «Idioma» (nombre accesible «Idioma: Español») | «Language» («Language: English») |
| `shell.menuOpen` / `shell.menu` / `shell.menuClose` | «Abrir menú» / «Menú» / «Cerrar menú» | «Open menu» / «Menu» / «Close menu» |
| `shell.breadcrumb` | «Migas de pan» | «Breadcrumb» |
| `shell.toc` / `shell.tocLabel` | «Resumen» / «En esta página» | «Summary» / «On this page» |
| `shell.footer` | «Alliance Codex es un proyecto comunitario independiente, no afiliado a PokeAlliance.» | «Alliance Codex is an independent community project, not affiliated with PokeAlliance.» |
| `ui.pagination` / `ui.prev` / `ui.next` / `ui.page` | «Paginación» / «Anterior» / «Siguiente» / «Página» | «Pagination» / «Previous» / «Next» / «Page» |
| `ui.pinHint` | «Mantén Shift para fijar» | «Hold Shift to pin» |
| `ui.views.label` / `cards` / `slots` / `list` | «Vista» / «Cards» / «Slots» / «Lista» | «View» / «Cards» / «Slots» / «List» |
| `ui.close` / `ui.dismiss` | «Cerrar» / «Cerrar aviso» | «Close» / «Dismiss» |
| `ui.dataError` | «No se pudieron cargar los datos.» | «Couldn't load the data.» |

- **Comprobaciones:**
  - `tests/i18n/messages.test.ts`: mismas claves en `es` y `en`, ninguna hoja vacía, mismos marcadores `{x}` en cada par y plurales con `one` y `other`;
  - `scripts/i18n/check.mjs` (en `pnpm ci`): falla si una clave de `es.ts` no aparece como `.<clave>` en `src/` ni en `src/i18n/dynamic-keys.ts`, y si `rg "locale === '(es|en)'"` encuentra algo en `src/components`, `src/pages` o `src/layouts`. Una clave que el código lee con acceso calculado (`messages.ui.views[view]`, una etiqueta de estado por su `enum`) se declara en `src/i18n/dynamic-keys.ts` (`export const dynamicKeys = ['ui.views.cards', …] as const`); `messages.test.ts` comprueba que cada entrada de esa lista existe en `es.ts`, así la lista no oculta claves borradas.

### 13.3 Formatos

Todos viven en `src/lib/format/` y no dependen de `@js-temporal/polyfill`. Las fechas y horas del juego se calculan en `America/Sao_Paulo` con `Intl.DateTimeFormat` y `timeZone`.

| Formateador | Regla | es | en |
|---|---|---|---|
| `formatInteger(n)` | Agrupa siempre: `Intl.NumberFormat('es-ES', { useGrouping: 'always' })` y `en-US`. Sustituye a A8 (`es-MX`) porque el sistema de diseño aprobado agrupa con punto (A8, §1.2) | «57.960», «1.200», «850» | «57,960», «1,200», «850» |
| `formatDecimal(n, d)` | coma decimal en `es`, punto en `en` | «1,5» | «1.5» |
| `formatPercent(x, d = 0)` | sin espacio; delta con signo «+» o «−» (U+2212) | «53%», «−8,4%» | «53%», «−8.4%» |
| `formatSigned(n)` | Boost y bandas | «+20», «+15 a +20» | «+20», «+15 to +20» |
| `formatPokedolares(n)` | Reglas y tabla de §4.3 (`DS:guias/40`). Sprite de 32 antes del número | «850», «2,5k», «150k», «1,5kk», «150kk», «1.200kk» | «850», «2.5k», «150k», «1.5kk», «150kk», «1,200kk» |
| texto para lector de pantalla de `formatPokedolares` | cifra exacta con plural; la forma corta visible es `aria-hidden` | «150.000.000 Pokédólares», «1 Pokédólar» | «150,000,000 Pokédollars», «1 Pokédollar» |
| `formatDiamonds(n)` | entero agrupado + «Diamonds» (término del juego) | «2.400 Diamonds» | «2,400 Diamonds» |
| `formatRealMoney(n, moneda)` | símbolo + espacio duro + cifra; céntimos solo si no son cero | «R$ 90», «US$ 120», «MX$ 1.800», «R$ 90,50» | «R$ 90», «US$ 120», «MX$ 1,800», «R$ 90.50» |
| `formatRating(x)` | un decimal con punto en ambos idiomas (tablero y `DS:guias/40`; X5); el nombre accesible lleva el número de reseñas | «4.6»; «4.6 de 5 (23 reseñas de operaciones)» | «4.6»; «4.6 out of 5 (23 trade reviews)» |
| `formatDate(d)` | `es` dd/mm/aaaa | «18/09/2026» | «Sep 18, 2026» |
| `formatTime(d)` | `es` 24 h (`hourCycle: 'h23'`) | «14:32» | «2:32 PM» |
| `formatDateTime(d)` | fecha y hora | «18/09/2026, 14:32» | «Sep 18, 2026, 2:32 PM» |
| `formatServerTime(d)` | hora del servidor con sufijo | «18/09/2026, 14:32 (hora de Brasilia)» | «Sep 18, 2026, 2:32 PM (Brasília time)» |
| `formatDayMonth(d)` / `formatWeekday(d)` | gráfico y tooltip compacto de Guild | «18/09» / «Viernes 18/09» | «Sep 18» / «Friday, Sep 18» |
| `formatDateRange(a, b)` | intervalos | «14/09 a 20/09» | «Sep 14 – 20» (`formatRange`) |
| `formatRelative(d)` | `Intl.RelativeTimeFormat(locale, { style: 'short' })` hasta 24 h; después, `formatDate` | «hace 12 min», «hace 1 h» | «12 min. ago», «1 hr. ago» |
| `formatLevelRequirement(n)` | nivel requerido | «Nivel 120» (en fila: «Requisito: Nivel 120») | «Level 120» («Requirement: Level 120») |
| `formatTier(t)` | número → «T{n}»; texto tal cual | «T3», «Legendary» | «T3», «Legendary» |
| `formatDexNumber(n)` | número de Pokédex | «Nº 6» | «No. 6» |
| Desconocido | U+2014 según G7; en el tooltip la fila se omite | «—» | «—» |
| Listas | canales de contacto y elementos separados por coma; opciones de precio unidas por «o» / «or» (`PriceOptions`) | «Discord, Correo, Teléfono +55»; «900kk o 2.400 Diamonds» | «Discord, Email, Phone +55»; «900kk or 2,400 Diamonds» |

### 13.4 Términos del juego y nombres de elementos

- **Términos iguales en los dos idiomas** (sin `lang`): nombres de Pokémon, ítems, NPC y lugares; Tier, T1–T7, Legendary, Mythic, ULTIMATE, Super Rare, Ultra Rare, Shiny, Held Items, Memory Slots, Star Level, Boost, NPC Price, PVE, PVP, Diamonds, Server Save, dailies, Lv., y los rangos de guild Leader, Vice-Leader y Member (G-24). Los NPC conservan su nombre («Fisherman», «Dr. Vektor»).
- **Elementos:** se localizan con `content/elementos.json`, en el orden y con los nombres de §8.0.5. `pnpm content:check` comprueba que cada elemento presente en `content/pokemon.json` tiene nombre en los dos idiomas (§3.13).

### 13.5 SEO y metadatos

- **Configuración:** `site: 'https://pokealliance-codex.vercel.app'` en `astro.config.mjs`.
- **En cada página:**
  - `<title>`: «{h1} · Alliance Codex»; el Inicio usa S-01; la ficha, «{nombre} · Pokédex · Alliance Codex».
  - `<meta name="description">`: obligatoria, de 50 a 160 caracteres, única por ruta e idioma, sin eslogan, sin «Alliance Codex» (ya está en el título) y sin cifras que no salgan de los datos. Cada plantilla de la tabla siguiente lleva texto fijo suficiente para pasar de 50 con los datos más cortos del registro; las de la ficha miden hoy 80 (es) y 73 (en) como mínimo, con `piplup` y `burmy`, y como máximo 130 y 125.
  - `<link rel="canonical">`: URL absoluta de la propia ruta, con barra final y sin consulta.
  - `<link rel="alternate" hreflang="es|en|x-default">`: URLs absolutas de la misma ruta en cada idioma; `x-default` apunta a la versión `es`.
  - Open Graph: `og:site_name` «Alliance Codex», `og:title` (igual que `<title>`), `og:description`, `og:url` (la canónica), `og:type` `website`, `og:locale` `es_ES` / `en_US` y `og:locale:alternate`. `twitter:card` `summary`. En este corte no hay `og:image` ni JSON-LD (§15).
  - `<meta name="theme-color" content="#0c0e12">` (S-11) y `<meta name="color-scheme" content="dark">`.
- **`noindex`** (`<meta name="robots" content="noindex">`): la 404; el marcador de posición del mapa mientras no tenga contenido propio (A11); el marcador de Comparar Pokémon hasta F5 (§8.14); las rutas de Comercio y de cuenta que §9.3 marca como no indexables; las rutas de paridad del build visual (§14.5).
- **Rastreo:** `public/robots.txt` con `User-agent: *`, `Allow: /` y `Sitemap: https://pokealliance-codex.vercel.app/sitemap-index.xml`. El sitemap se genera con `@astrojs/sitemap` (dependencia nueva, fijada), con `i18n: { defaultLocale: 'es', locales: { es: 'es', en: 'en' } }`, e incluye las 1.820 fichas de Pokémon. Excluye las rutas `noindex`.
- **Plantillas de título y descripción:**

| Ruta | Título es / en | Descripción es | Descripción en |
|---|---|---|---|
| `/{l}/` | S-01 | «Wiki comunitaria de PokeAlliance: Pokédex, sistemas, ítems, actividades, comercio y herramientas de guild.» | «PokeAlliance community wiki: Pokédex, systems, items, activities, trade and guild tools.» |
| `/{l}/pokedex/` | «Pokédex · Alliance Codex» | «Las {n} variantes de Pokémon de PokeAlliance con nivel requerido, tier, elementos y rol.» | «All {n} PokeAlliance Pokémon variants with required level, tier, elements and role.» |
| `/{l}/pokedex/{slug}/` | «{nombre} · Pokédex · Alliance Codex» | «Ficha de {nombre} en la Pokédex de PokeAlliance: Nº {n}, {elementos}, nivel requerido {nivel}, tier {tier}, rol {rol}.» Cada parte sin dato se omite con su separador; sin ninguna, termina en «PokeAlliance.». `unown-a`: «Ficha de Unown A en la Pokédex de PokeAlliance: Nº 201, Psíquico, nivel requerido 20.» (85) | «{name} entry in the PokeAlliance Pokédex: No. {n}, {elements}, required level {level}, tier {tier}, role {role}.» `unown-a`: «Unown A entry in the PokeAlliance Pokédex: No. 201, Psychic, required level 20.» (79) |
| página de sistema (§8.4) | «{sistema} · Alliance Codex» | primera frase del texto del sistema, cortada en palabra completa por debajo de 160 caracteres | igual, con el texto `en` |
| `/{l}/comercio/` | «Comercio · Alliance Codex» / «Trade · Alliance Codex» | «Anuncios de Pokémon, ítems, Diamonds y Pokédólares de PokeAlliance con contacto verificado del vendedor y reseñas de operaciones.» | «PokeAlliance listings for Pokémon, items, Diamonds and Pokédollars with verified seller contact and trade reviews.» |
| ruta de Guild de §10 | «Guild · Alliance Codex» | «Actividad diaria, semanal y mensual de tu guild de PokeAlliance a partir del export del juego.» | «Daily, weekly and monthly activity of your PokeAlliance guild from the game export.» |
| ruta de Comparar de §11 | «Comparar Pokémon · Alliance Codex» / «Compare Pokémon · Alliance Codex» | se escribe con las reglas de arriba al implementar F5 | ídem, en inglés |
| `/{l}/cambios/` | «Cambios · Alliance Codex» / «Changes · Alliance Codex» | «Historial de cambios de PokeAlliance y de esta wiki, del más reciente al más antiguo, agrupado por mes.» (103) | «History of PokeAlliance and wiki changes, newest first, grouped by month.» (73) |
| `/{l}/mapa/` | «Mapa · Alliance Codex» / «Map · Alliance Codex» | `noindex` mientras sea marcador de posición | — |
| 404 | «Página no encontrada · Alliance Codex» / «Page not found · Alliance Codex» | `noindex` | — |
| resto de rutas de §8 | «{h1} · Alliance Codex» | se escribe con las reglas de arriba al implementar F2; `seo:check` la valida | ídem, en inglés |

- **Comprobación:** `scripts/seo/check-dist.mjs` (en `pnpm ci`, tras `pnpm build`) recorre `.vercel/output/static/**/*.html` y falla si:
  - falta alguno de los elementos obligatorios, o una canónica no es absoluta o no coincide con la ruta;
  - hay `hreflang` sin su recíproco;
  - se repite un título o una descripción entre rutas indexables;
  - una ruta `noindex` aparece en el sitemap;
  - existe `/_paridad/` en el build de producción (§14.5);
  - el build de producción contiene `/comercio/datos.json`, una ruta `/comercio/anuncio/*` o `/comercio/vendedor/*` prerenderizada (§9.2, CA-9.1).

### 13.6 Rendimiento

**Línea base** (build del 2026-09-19 00:42 en `dist/client`, gzip -9):

- runtime de React (`client.*.js`): 64,8 KB;
- `GuildRankingTool`: 129,5 KB;
- polyfill de Temporal (`server-save.*.js`): 45,5 KB, en el Inicio;
- `PokemonExplorer`: 18,6 KB;
- HTML de la Pokédex: 519.525 B sin comprimir (33,2 KB gzip), de los que 457.633 B son el atributo `props` de la isla con las 910 entradas; las mismas entradas en JSON compacto de filas miden 74.931 B (13,9 KB gzip);
- hoja compartida `AppLayout.*.css`: 203,7 KB sin comprimir (35,3 KB gzip).

**Prototipo medido** (cierre de F1, build del 2026-09-22 en `.vercel/output/static`, gzip -9): `/es/pokedex/` con `PageLayout` (plantilla B), la isla `pokedex` de PR5 (`client:load`) y 12 `DexCard` por página sobre las 910 variantes del registro actual, con todas las hojas de M6 en `global.css`. Con ese registro el HTML no lleva paneles de tooltip: ningún Pokémon tiene `drops` y los chips de elemento esperan a que `src/lib/content/registry.ts` lea `content/elementos.json` (§3.12). Las piezas de Slots y Lista llegan en chunks diferidos (`import()`, 0,6 a 1,7 KB gzip cada uno). Las métricas de laboratorio son tres cargas por caso con el perfil de red y CPU de esta sección.

| Medida | Límite | Prototipo |
|---|---|---|
| HTML | ≤ 80 KB gzip y ≤ 450 KB | 9,9 KB gzip y 53.603 B (`/en/pokedex/`: 9,8 KB y 53.401 B) |
| Props de la isla | ≤ 20 KB | 7.662 B (`/en/pokedex/`: 7.551 B): las 12 filas de la primera página y los espacios `ui` y `pokedex` del diccionario |
| `/es/pokedex/datos.json` | ≤ 60 KB gzip y ≤ 400 KB | 14,1 KB gzip y 80.934 B |
| JS inicial | ≤ 110 KB gzip | 108,5 KB (108.522 B): runtime de React 64,8 y sus módulos 4,9; isla 11,0; scripts de `PageLayout` 6,7; `@floating-ui/dom` 7,0; piezas de juego que comparte con Slots y Lista (`Sprite`, `SpriteStage`, `NestedEntity`, `GameTooltip` y sus importes) 4,4; paleta de búsqueda (`client:idle`) 2,9; adaptador de sprites (`resolve.ts`) 1,6; el resto 5,2. `SortSelect` ya no viaja en una lista de un solo orden: lo compone la raíz de la lista que lo necesita (V6). Los importes leen sus dos sprites de un módulo que el build recorta del registro (D-017), no el registro entero |
| CSS por página | ≤ 30 KB gzip | 14,9 KB (14.896 B; la hoja compartida es la única) |
| Hoja compartida (S17) | ≤ 100.000 B | 98.761 B: componentes 88,1 KB, `base` 4,1 KB, `theme` 2,9 KB, utilidades 2,3 KB. Tailwind lee solo la superficie nueva (`source(none)` y un `@source` por carpeta de componentes, las rutas de paridad, los scripts y cada página ya migrada) y no las palabras del código que parecen utilidades (`filter`, `container`…); antes medía 135.968 B, 33.972 de utilidades de los archivos heredados, `docs/`, `tests/` y `design/` |
| LCP | ≤ 2,5 s | 0,60–0,63 s a 1440 y 0,56–0,60 s a 390; con `?view=list&page=2`, 0,57–0,60 y 0,57 s; con la vista guardada en Slots, 1,87–1,92 s y 1,84–1,93 s |
| CLS de página | ≤ 0,02 | 0 en todos los casos, también los dos de PR4: mientras la raíz tiene `data-ac-pending`, lo que la sigue en la columna (el pie) se pinta oculto con ella. Desde 1280 la fila del marco reserva sus tres columnas antes de que llegue la que sigue a `<main>` (D-017): con la CPU a 20× la rejilla ya no pasa de 4 columnas a 3 (antes, 0,12 a 0,30) |
| CLS en rejillas | 0 | 0 en todos los casos |
| INP | ≤ 200 ms | 32–80 ms: cambiar de vista, abrir la paleta y abrir el menú móvil (el prototipo no tiene filtros visibles ni disparadores en la vista Cards) |

**Presupuestos** (bloqueantes en `pnpm ci` mediante `scripts/perf/check-budgets.mjs`):

| Medida | Límite | Cómo se mide |
|---|---|---|
| JS inicial de páginas de contenido (Inicio, Sistemas y páginas de sistema, Actividades, Cambios, Herramientas, 404, marcador del mapa) | ≤ 90 KB gzip | Suma gzip -9 de los `script[type=module][src]` y de `component-url` y `renderer-url` de cada `astro-island` con `client:load` o `client:idle`, más sus `import` estáticos recursivos. |
| JS inicial de la Pokédex, Tier list, Ítems, Buscar y la ficha | ≤ 110 KB gzip | igual |
| JS inicial de Comparar | ≤ 120 KB gzip | igual |
| JS inicial de Comercio, de `/{l}/cuenta/` y de sus páginas de Comercio (`/{l}/cuenta/perfil/`, `/{l}/cuenta/anuncios/`, `/{l}/cuenta/operaciones/`) | ≤ 140 KB gzip | igual |
| JS inicial que añade la entrada de cuenta de la cabecera (§9.16.1) a cada página | ≤ 4 KB gzip | Suma gzip -9 de los archivos que alcanza el script de `AccountEntry` y ningún otro script inicial de la página. Solo existe en un build con los ajustes públicos de Supabase. |
| JS inicial de Guild | ≤ 200 KB gzip, polyfill de Temporal incluido (45,3 KB hoy; §3.13) | igual |
| Cada chunk diferido (`client:visible`, `client:only` tras interacción, `import()` dinámico: vista de outfit WebGL, gráficos) | ≤ 60 KB gzip | por archivo |
| Índice de la paleta de búsqueda, cargado al abrirla | ≤ 60 KB gzip | archivo JSON |
| Datos de una lista (`datos.json` de PR5), cargados al hidratar | ≤ 60 KB gzip y ≤ 400 KB sin comprimir | archivo JSON |
| Props de una isla de lista | ≤ 20 KB sin comprimir (solo las filas de la primera página, PR5) | atributo `props` de cada `astro-island` |
| CSS por página | ≤ 30 KB gzip en total | suma de los `link[rel=stylesheet]` |
| HTML por página | ≤ 80 KB gzip y ≤ 450 KB sin comprimir | archivo |
| Fuentes | 0 archivos para Verdana (del sistema); Poppins ≤ 2 archivos woff2 (500 y 600, latin) y ≤ 50 KB en total | red, en `prod.spec.ts` |

- **Prototipo medido (cierre de F1).** Antes de F2 se construye `/es/pokedex/` con `PageLayout`, la isla `pokedex` de PR5 y el `DexCard` real (12 tarjetas con sus paneles de tooltip) sobre el registro actual, y se miden su HTML, sus props y `/es/pokedex/datos.json`. Los valores medidos se escriben en esta sección junto a la línea base. Si alguno supera su límite, F2 no empieza: se reduce el HTML (menos paneles en el servidor, datos de tooltip en `refs`) hasta cumplirlo. Un límite solo se cambia a la baja con la medida, nunca al alza sin decisión del propietario.
- **Imágenes:**
  - todo `<img>` lleva `width` y `height`;
  - los sprites de píxel usan `image-rendering: pixelated` a escala entera;
  - el arte fuera de la primera fila lleva `loading="lazy"`;
  - la imagen candidata a LCP no es lazy.
- **Rejillas:** nunca `content-visibility: auto` en tarjetas con subgrid (`CGS §14`).
- **Métricas de laboratorio** (bloqueantes en `perf.spec.ts`, sobre la salida de Vercel servida por el emulador de §14.3):
  - **Perfil de red y CPU:** RTT 150 ms, bajada 1,6 Mbps, subida 750 Kbps y CPU 4× por CDP. El arte de `wiki.pokealliance.com` se responde con un PNG local de 140 × 140.
  - **Vistas:** 390 × 844 y 1440 × 900.
  - **Páginas:** `/es/`, `/es/pokedex/`, `/es/pokedex/charizard/`, `/es/comercio/`, la ruta de Guild con el fixture importado y la de Comparar. Además, dos casos de primer render con estado (PR4): `/es/pokedex/` con `localStorage['ac:vista:pokedex'] = 'slots'` puesto con `addInitScript` antes de la carga, y `/es/pokedex/?view=list&page=2`.
  - **Umbrales:**

| Métrica | Umbral | Definición |
|---|---|---|
| LCP | ≤ 2,5 s | último `largest-contentful-paint` antes de la primera interacción. |
| CLS de página | ≤ 0,02 | ventana de sesión máxima (hueco de 1 s, máximo 5 s) de entradas `layout-shift` con `hadRecentInput === false`, hasta `document.fonts.ready` + 2 s. |
| CLS en rejillas | exactamente 0 | Ninguna entrada `layout-shift` (con `hadRecentInput === false`) tiene un `source.node` dentro de `[data-card-grid]`, `[data-slots]` o `[data-list]` (§7.7.4, V8). Cuenta desde la carga hasta `document.fonts.ready` + 2 s, y otra vez durante 2 s tras cambiar a Slots, a Lista y de página. En los dos casos de primer render con estado, además, ninguna captura de pantalla tomada antes de que la raíz pierda `data-ac-pending` muestra una tarjeta del estado por defecto (PR4). |
| INP | ≤ 200 ms | `PerformanceEventTiming` con `durationThreshold: 16` en: cambiar de vista, cambiar un filtro, abrir un tooltip con foco, abrir la paleta con Ctrl + K y abrir el menú móvil. |

- **Sin terceros nuevos en ejecución:** solo `wiki.pokealliance.com` (arte, hasta el espejo de §15) y Supabase (Comercio y Guild). Poppins se sirve desde el propio sitio (§3.9). Sin analítica.

### 13.7 Accesibilidad (WCAG 2.2 AA)

- **Contraste.** Texto ≥ 4,5:1; bordes con significado, iconos y anillos ≥ 3:1. `tests/design/tokens.test.ts` calcula cada par desde `tokens.css`, no desde la documentación.
  - El sistema de diseño aprobado conserva cuatro pares por debajo del mínimo:
    - `ring` sobre `bg-secondary` (2,96:1), `bg-tertiary` (2,48:1) y `tt-panel` (2,51:1);
    - `text-quaternary` sobre `bg-tertiary` (4,26:1), solo en el texto del disparador de búsqueda en hover;
    - `border-primary` como borde de control (1,70:1; el texto del control lo identifica);
    - la barra del día en curso a `opacity-partial` (2,08:1; el eje dice «en curso»).
  - La prueba los lista como excepciones con su razón exacta. Los dos primeros incumplen WCAG 1.4.11 y 1.4.3: hasta que el propietario responda Q10, el sitio se declara «WCAG 2.2 AA salvo 2 excepciones de contraste documentadas».
  - Con `ring` `#5b64f0` los tres primeros pares darían 3,91, 3,26 y 3,31; con `text-quaternary` `#8a8d93`, 4,55.
- **Foco.**
  - `outline: 2px solid` `ring` con 1 px de separación en todo lo enfocable, campos incluidos.
  - Nada enfocado queda tapado por la cabecera fija (WCAG 2.4.11): `scroll-padding-top` igual a `layout-header` (64; §3.6).
  - En `forced-colors`, el anillo usa `Highlight`.
- **Teclado.**
  - Todo disparador de tooltip es un `<a>` o `<button>` con `aria-describedby`. El foco abre el tooltip y Escape lo cierra, también si está fijado.
  - Shift fija y suelta según TT8; como máximo hay un tooltip sin fijar y uno fijado (TT9, §7.5.4).
  - El orden de tabulación sigue el visual: en una tarjeta, título, entidades anidadas y pie. Sin `tabindex` positivo.
  - Los toggles usan `aria-pressed`; los plegables y «+N», `aria-expanded` y `aria-controls`; las cabeceras ordenables, `aria-sort`.
  - El menú móvil y los diálogos atrapan el foco y lo devuelven al disparador al cerrar.
- **Contenido en hover o foco (WCAG 1.4.13).** El tooltip se puede descartar con Escape, se puede recorrer con el puntero (zona segura entre disparador y panel) y persiste mientras el puntero o el foco sigan en él.
- **Táctil.**
  - Por debajo de 768 px o con `pointer: coarse`, todo objetivo interactivo mide ≥ 44 × 44 (`size-touch`).
  - Excepciones: enlaces dentro de un párrafo y enlaces de filas de hechos. Estos cumplen WCAG 2.5.8 con 8 px de separación bajo `pointer: coarse` (objetivo de 24 px sin solapes).
  - El primer toque abre el tooltip, el segundo sigue el enlace y un toque fuera lo cierra.
- **Movimiento reducido.** Con `prefers-reduced-motion: reduce` no se anima nada (§6.4): tooltip sin entrada, sin rebote de sprites, Diamond en el fotograma 0, hoja móvil sin desplazamiento y `scroll-behavior: auto`. La vista de outfit dibuja un solo fotograma (ya ocurre en `OUT:178`, `:194`).
- **Texto:**
  - ningún texto visible por debajo de 12 px calculados (U-02);
  - zoom al 200 % y los ajustes de espaciado de WCAG 1.4.12 no recortan ni solapan texto de tarjetas: las pistas crecen;
  - reflujo a 320 px CSS sin desplazamiento horizontal de la página; las tablas se desplazan dentro de su contenedor.
- **Semántica y lectores:**
  - los sprites son `aria-hidden` y su nombre está en el texto;
  - los importes se leen con la cifra exacta (§13.3);
  - los conteos cambian en `aria-live="polite"` y los avisos son `role="status"`;
  - el medidor de entrenamiento es `role="meter"`;
  - las tarjetas son `article` con `h3`, y los hechos, un `dl`;
  - los errores de formulario se enlazan con `aria-describedby`, con `aria-invalid` por campo;
  - cada página tiene el `SkipLink` y un solo `h1`.
- **Idioma de las partes:** §13.1.

---

## 14. Pruebas

Esta sección ejecuta las pruebas que definen las demás: V3-1–V3-7 (§3.14), V4-1–V4-6 (§4.7), V5-1–V5-7 (§5.10), V6-1–V6-5 (§6.6), C7-01–C7-15 (§7.14), WG, WA, WL, WD y los criterios de cada página de §8, CA-9.1–CA-9.20, CA-10.1–CA-10.14 y CA-11.1–CA-11.9, y las pruebas RLS de §9.12.2 y §10.13 sobre `supabase start` local. Cada criterio S1–S21 de §2 tiene al menos una prueba automática; S20 y S22 son de revisión. Además:
- `src/lib/trade/*` (búsqueda, filtros, orden, texto copiado, validación) y `src/lib/tools/guild-analytics.ts` tienen pruebas unitarias con reloj inyectable;
- una comprobación de build compara ids, títulos y orden del `Toc` de cada página con sus `Section` (§7.11);
- `tests/sprites/resolve.test.ts:134-157` pasa a los nombres de keyframes de §7.4.2;
- `tests/e2e/smoke.spec.ts` deja de buscar `#main-content` (hoy en `:20`, `:447` y `:559`) y usa `#contenido`.

### 14.1 Comandos

`package.json`:

- **Nuevos scripts:**
  - `"perf:budget": "node scripts/perf/check-budgets.mjs"`;
  - `"seo:check": "node scripts/seo/check-dist.mjs"`;
  - `"i18n:check": "node scripts/i18n/check.mjs"`;
  - `"test:visual": "node scripts/visual/run.mjs"`, que fija `VISUAL=1`, construye y ejecuta el proyecto `visual`;
  - `"visual:goldens": "node scripts/visual/goldens.mjs"`, solo local;
  - `"design:tokens"` y `"design:check"` de §3.2 y §3.11.
- **Cambios en scripts existentes:**
  - `"preview"`: `node scripts/test/serve-vercel-output.mjs --port 4322` (sustituye a `astro preview`, que falla con el adaptador de Vercel: S22);
  - `"ci"`: `pnpm content:check && pnpm design:check && pnpm format:check && pnpm lint && pnpm check && pnpm i18n:check && pnpm test && pnpm build && node scripts/design/check-dist.mjs && pnpm perf:budget && pnpm seo:check`;
  - `"test:e2e"`: `playwright test --project=desktop --project=mobile --project=webkit-mobile --project=reduced-motion --project=prod`.
- **Dependencias de desarrollo nuevas, con versión fija:** `@axe-core/playwright`, `pixelmatch`, `pngjs`. `@playwright/test` pasa de `^1.63.0` a `1.63.0` exacto. `@astrojs/sitemap` (§13.5) y `@floating-ui/dom` 1.8.0 (§3.8) entran como dependencias.

### 14.2 Unitarias (Vitest)

`vitest.config.ts` pasa a exportar `getViteConfig({ test: { … } })` de `astro/config` (`node_modules/astro/dist/config/index.js:4`), para que Vitest compile `.astro`, con `include: ['tests/**/*.test.{ts,tsx}']` (hoy `:12`). Los componentes TSX se renderizan con `react-dom/server`. Los `.astro` no se pueden renderizar con `react-dom/server`: se renderizan con la Container API de Astro (`experimental_AstroContainer` de `astro/container`, `node_modules/astro/dist/container/index.js:76`), creada con `renderers: await loadRenderers([getContainerRenderer()])` (`loadRenderers` de `astro:container`, `getContainerRenderer` de `@astrojs/react/container-renderer`) para los `.astro` que contienen TSX, y `container.renderToString(Componente, { props })`.

| Archivo | Comprueba |
|---|---|
| `tests/i18n/messages.test.ts` | paridad de claves `es`/`en`, hojas no vacías, marcadores iguales y plurales completos (§13.2) |
| `tests/i18n/forbidden.test.ts` | ningún valor de los diccionarios contiene la lista de §12.22 |
| `tests/i18n/alternate-path.test.ts` | `getAlternatePath`: `/es/pokedex/charizard/` ↔ `/en/pokedex/charizard/`, `/es/` ↔ `/en/`, rutas sin prefijo → `/es/…` |
| `tests/i18n/config.test.ts` (existente) | sin cambios |
| `tests/format/numbers.test.ts` | cada fila numérica de §13.3 en los dos idiomas: la tabla de Pokédólares completa, la promoción 999.950 → «1kk», 1.250.000 → «1,3kk» / «1.3kk», el texto exacto para lector de pantalla y el singular; Diamonds, dinero real con y sin céntimos, porcentajes con U+2212, `formatRating` |
| `tests/format/dates.test.ts` | los formateadores de fecha de §13.3, según V4-3 (§4.7): cada salida se compara con el mismo `Intl` construido en la prueba, y en `es` se verifican literalmente el orden dd/mm, las 24 h, «a» y «hace» |
| `tests/format/unknown.test.ts` | la regla de la unión de G7: `gridKeys` y `listingLayout` (`CARD_GRID_SYSTEM.md` §5.3) devuelven «—» solo si otra entidad del conjunto tiene la clave |
| `tests/time/server-save.test.ts` (existente) | se amplía: próxima medianoche de `America/Sao_Paulo` antes y después de las 00:00, desde UTC−6 y UTC+9, sin Temporal |
| `tests/supabase/errors.test.ts` | cada código de §12.14.1 y el genérico |
| `tests/components/contracts.test.tsx` | Los contratos de §7 que dependen del texto: `GameTooltip` omite filas sin valor y no escribe «—»; `NestedEntity` emite `aria-describedby` hacia `role="tooltip"`; `ViewToggle` emite `aria-pressed` y los textos del diccionario; `PokedolaresAmount` pinta la forma corta con `aria-hidden` y la cifra exacta como texto accesible; `Footer`, `Header` y `SearchTrigger` (`.astro`, con la Container API) en `en` no contienen textos por defecto en español. |
| `tests/content/*`, `tests/sprites/resolve.test.ts`, `tests/tools/guild-ranking.test.ts`, `tests/supabase/guilds.test.ts` (existentes) | se conservan; `guild-ranking.test.ts` actualiza rangos (G-24) y números con `locale` (G-49). `tests/trade/draft.test.ts` y `tests/map/client-map.test.ts` se sustituyen o se borran con el archivo que prueban (§9 y A11). |

### 14.3 End-to-end (Playwright)

**Servidores** (`webServer` como lista):

1. **Desarrollo:** `node node_modules/astro/bin/astro.mjs dev --host 127.0.0.1 --port 4321` con `env: { COMERCIO_DEMO: '1' }` (así las pruebas de Comercio tienen anuncios, §9.2), sin `pwsh`: `scripts/test/start-astro.ps1` se retira porque el contenedor de Playwright no trae `pwsh`.
2. **Salida de Vercel:** `node scripts/test/serve-vercel-output.mjs --port 4322` sobre `.vercel/output` tras `pnpm build` (sin `COMERCIO_DEMO`). Emula el subconjunto de la Build Output API v3 que usa `.vercel/output/config.json`, sin tabla de rutas propia, así las pruebas comprueban la configuración que se despliega (las 302 de `astro.config.mjs` incluidas):
   - recorre `routes` en orden: aplica `headers` y `continue`; una ruta con `status` 3xx y `headers.Location` responde esa redirección; `{ "handle": "filesystem" }` sirve el archivo de `static/` que corresponda (`x/` como `x/index.html`); una ruta con `dest` que nombra una función (`_render`) importa `functions/<dest>.func/` según su `.vc-config.json` (`handler: "dist/server/entry.mjs"`) y responde con `default.fetch(request)`, que es lo que exporta hoy esa entrada, con el `status` de la ruta si lo trae;
   - así la 404 bajo demanda (§8.12) responde con la página del idioma y estado 404;
   - una propiedad de ruta que no conoce (`has`, `missing`, `check`, `middlewarePath`…) hace fallar el arranque con su nombre, para que un cambio del adaptador no pase inadvertido.

Además, `devToolbar: { enabled: false }` en `astro.config.mjs`, para que axe no revise la barra de Astro.

**Proyectos:**

| Proyecto | Dispositivo | Servidor | Specs |
|---|---|---|---|
| `desktop` | Desktop Chrome 1440 × 900 | desarrollo | todos salvo `perf`, `prod`, `motion`, `mobile-menu` y `visual` |
| `mobile` | 390 × 844, `isMobile`, `hasTouch`, `deviceScaleFactor: 1` | desarrollo | `smoke`, `a11y`, `keyboard`, `contract`, `tooltip`, `content-sentinel` |
| `webkit-mobile` | `devices['iPhone 13']` (WebKit, 390 × 844) | desarrollo | `mobile-menu` (V5-4: hoja, foco, Escape y color del velo `::backdrop`) |
| `reduced-motion` | Desktop Chrome, `reducedMotion: 'reduce'` | desarrollo | `motion` |
| `prod` | Desktop Chrome y 390 × 844 | salida de Vercel | `prod`, `perf`, `seo`, `links`, `money` |
| `visual` | Desktop Chrome, Windows | salida de Vercel con `VISUAL=1` | `tests/visual/*.spec.ts` (§14.5) |

En todos los proyectos, `page.route('https://wiki.pokealliance.com/**')` responde con un PNG local de 140 × 140, y el reloj se fija con `page.clock.setFixedTime('2026-09-18T17:32:00Z')` (14:32, hora de Brasilia) en las specs con fechas.

**Specs:**

| Archivo | Qué comprueba |
|---|---|
| `tests/e2e/smoke.spec.ts` | Se reescribe para v2: cada ruta de §14.4 responde 200 y tiene un `h1`. Los conteos visibles («{n} variantes», «{a} normales», «{b} Shiny», la línea del Inicio y cada «N páginas») son iguales a los calculados desde `content/`. Las vistas Cards, Slots y Lista cambian el contenido y la elegida persiste al recargar. Los filtros de la Pokédex viven en la URL (§12.20, punto 3). Se conservan los flujos de Guild con `tests/fixtures/guild-export.sample.json` que §10 mantenga. |
| `tests/e2e/a11y.spec.ts` | `@axe-core/playwright` con `withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` sobre §14.4. Falla con `serious` o `critical`; las únicas excepciones admitidas son los selectores de los pares de §13.7. Se repite con un tooltip abierto, el menú móvil abierto, la lista de idioma abierta, cada diálogo de Guild y Comercio abierto, y todos los plegables expandidos. |
| `tests/e2e/keyboard.spec.ts` | Tab y Shift+Tab por toda la página (máximo 400 paradas). Cada elemento enfocado tiene `outline-width` ≥ 2 px y color `ring`. `document.elementFromPoint` en su centro devuelve el elemento o un descendiente (WCAG 2.4.11). Ningún elemento enfocado tiene un ancestro `aria-hidden`. Escape cierra tooltip, menú, lista de idioma y diálogo, y el foco vuelve al disparador. |
| `tests/e2e/tooltip.spec.ts` | Hover, foco y toque abren el tooltip de una entidad anidada, un slot y una fila de Lista. Una tarjeta completa no abre ninguno. El panel es recorrible con el puntero (se mueve del disparador al panel sin cerrarse). Escape cierra incluso fijado. Shift solo fija; Shift+Tab y Shift+clic no fijan; una pulsación de más de 400 ms o con repetición no fija. Nunca hay más de un tooltip sin fijar ni más de uno fijado: con A fijado, abrir B deja A y B; fijar B cierra A. Dentro del tooltip no aparece «—». En `mobile`, el tooltip de un anuncio con dos held items y entrenamiento cabe en la ventana con desplazamiento interno. |
| `tests/e2e/mobile-menu.spec.ts` | V5-4 en `mobile` y en `webkit-mobile`. |
| `tests/e2e/contract.spec.ts` | 0 elementos `.eyebrow` (G1). Todo `kbd` visible pertenece a un `SearchTrigger` y Ctrl + K y Meta + K abren la paleta (PZ-02). Todo chevron visible está dentro de un control con `aria-expanded` (G8). No hay botón de tema mientras exista un solo tema (X2, PZ-01). En `mobile`, todo objetivo interactivo visible mide ≥ 44 × 44, salvo las excepciones de §13.7. Todo texto visible calcula ≥ 12 px. Hay un solo `role="search"` por página. |
| `tests/e2e/links.spec.ts` | Sobre la salida de Vercel: todo `a[href^="/"]` de las rutas de §14.4 y del menú completo responde 200, o 302 hacia una ruta que responde 200 (G12, PZ-04). Ningún enlace apunta a `/mapa/aportar/`. |
| `tests/e2e/i18n.spec.ts` | `<html lang>` correcto. El selector de idioma conserva ruta, consulta y ancla (`/es/pokedex/?variante=shiny#drops` → `/en/pokedex/?variante=shiny#drops`). En `es`, las frases de datos en inglés están dentro de `[lang="en"]`. |
| `tests/e2e/content-sentinel.spec.ts` | La lista de §12.22 sobre §14.4 y los estados de `a11y.spec.ts`. |
| `tests/e2e/money.spec.ts` | Cada importe del juego visible va precedido por el sprite `ui/pokedolares` (el elemento anterior al número es su `img`) y su texto accesible es la cifra exacta (G6, §13.3). |
| `tests/e2e/seo.spec.ts` | En la salida de Vercel: `/` responde 302 → `/es/`; `/es/mapa/aportar/` responde 302 → `/es/mapa/`; `/es/no-existe/` responde 404 con la página `es` y `/en/no-existe/` con la `en`, ambas `noindex`; en una muestra de rutas, `robots.txt` y el sitemap cumplen §13.5. El resto lo cubre `seo:check`. |
| `tests/e2e/prod.spec.ts` | Regresiones de prerenderizado (§12.20, puntos 1 y 3). Ninguna petición de fuentes a otro origen (§3.9). Los tamaños de fuente de §13.6. |
| `tests/e2e/perf.spec.ts` | LCP, CLS de página, CLS en rejillas e INP de §13.6 con el perfil de red y CPU indicado, también en los dos casos de primer render con estado (vista guardada y URL con `view` y `page`, PR4). |
| `tests/e2e/motion.spec.ts` | Con `reduced-motion`: `document.getAnimations().length === 0` 50 ms después de abrir un tooltip, el menú móvil y un diálogo. Los sprites animados muestran `object-position` del fotograma 0. `scroll-behavior` es `auto`. |

### 14.4 Rutas de prueba

- **Rutas.** Todas las rutas prerenderizadas del build de producción en los dos idiomas, leídas de `.vercel/output/static/{es,en}/**/index.html`. Las fichas de Pokémon se sustituyen por una muestra fija de seis slugs:
  - `charizard` y `shiny-charizard` (tableros);
  - `mime-jr` (sin imagen);
  - `unown-a` (tier y rol nulos);
  - `smeargle` (20 variantes);
  - `shiny-mimikyu` (último registro).
- **Se añaden:** la 404 de cada idioma y la ruta de Guild con `tests/fixtures/guild-export.sample.json` importado.
- **Mantenimiento.** La lista la genera `tests/e2e/routes.ts` después de `pnpm build`. En el proyecto `desktop` (servidor de desarrollo) se usa la misma lista cambiando el origen.

### 14.5 Pruebas visuales contra los tableros aprobados

**Qué se compara.** Capturas del sitio frente a los renders del arnés (`render.mjs`) de los tableros del lienzo v5, a 1440 px (seis tableros de página y los dos de componentes) y a 390 px (Inicio-movil). Las demás rutas a 390 px no tienen tablero: su referencia es una línea base del propio sitio aprobada por el propietario.

**Material versionado** (lo copia al repositorio el PR que introduce la prueba):

- `design/boards/`: los nueve `*.dc.html` y `canvas.json` del proyecto `canvas-v2/project`.
- `design/render/`:
  - `render.mjs`;
  - `design-type/artifact-type/dc-runtime.js`;
  - los PNG que referencia `blob-map.json`, en `design/render/blobs/`, con `blob-map.json` reescrito a rutas relativas (hoy son rutas absolutas del directorio temporal).
- `tests/visual/manifest.json`: la única lista de casos. Cada caso tiene:
  - `id`, `board`, `state` (JSON del arnés; siempre con `"tip": null` salvo en los casos de tooltip, porque Pokedex, Comercio y Sistema-Boost abren uno por defecto), `width` y `height`;
  - `route` y `siteState`: acciones de Playwright para llegar al mismo estado (vista, filtro, periodo de Guild, hover o foco del mismo disparador);
  - `crops`: pares `{ nombre, boardSelector, siteSelector }`;
  - `masks`: rectángulos con su desviación de la tabla de más abajo.
- `tests/visual/goldens/<id>.png` y `<id>.measure.json`: renders del arnés.
- `tests/visual/baselines/<ruta>--390.png`: líneas base del sitio.
- `tests/visual/content/` y `tests/visual/fixtures/`: los datos de los tableros (siguiente punto).

**Datos de paridad.** Con `VISUAL=1` el build:

1. resuelve el alias `@content` de `vite.resolve.alias` a `tests/visual/content/` en lugar de `content/`. `repository.ts` y `registry.ts` importan desde `@content/…`, con los mismos esquemas y `pnpm content:check`;
2. lee los anuncios, vendedores y reseñas de Comercio de `tests/visual/fixtures/comercio.json` a través del adaptador de datos de §9;
3. inyecta con `injectRoute` las rutas `/_paridad/componentes/` y `/_paridad/tarjetas/`, que componen los tableros Componentes y Tarjetas con los componentes reales;
4. marca todas las páginas `noindex`.

Los fixtures contienen exactamente las entidades que dibujan los tableros (los Pokémon de Pokédex y de la ficha con sus drops, los anuncios de Comercio y los 25 miembros y días de Guild en `tests/visual/fixtures/guild/*.json`). Se exportan una sola vez desde los datos de `canvas-v2/gen/*.py`.

El build de producción no contiene `/_paridad/` ni lee `tests/`. Lo comprueba `seo:check`.

**Cómo se generan los goldens.**

- `pnpm visual:goldens` recorre el manifiesto y ejecuta, por caso, `node design/render/render.mjs design/boards/<board>.dc.html --state '<json>' --width <w> --height <h> --scale 1 --out tests/visual/goldens/<id>.png --measure tests/visual/goldens/<id>.measure.json`.
- Se ejecuta en Windows con el Chromium de `@playwright/test` 1.63.0: los tableros usan la Verdana del sistema y Poppins de Google Fonts, y en Linux Verdana cae a DejaVu Sans.
- Cada golden debe cumplir en su `measure.json`: `overflow: false`, `brokenImages: []` y `maxSpread: 0` en toda rejilla de tarjetas.
- Los goldens solo se regeneran cuando cambia un tablero, y ese cambio exige la aprobación del propietario en el PR.

**Cómo se captura el sitio.**

- Mismo viewport y `deviceScaleFactor: 1`, `reducedMotion: 'reduce'`, `animations: 'disabled'`, `caret: 'hide'`, reloj fijo (§14.3).
- Espera a `document.fonts.ready` y a que todas las `img` terminen de cargar (`complete`).
- Luego aplica `siteState`.

**Cómo se compara** (`tests/visual/compare.ts`, con `pixelmatch` y `pngjs`; no se usa `toHaveScreenshot`, porque su máscara solo pinta la captura y no el golden):

1. **Geometría (bloqueante).** Para cada ancla del caso (cabecera, barra lateral, columna principal, `h1`, cada rejilla y su primera tarjeta, conmutador de vista y pie), |Δx|, |Δw|, |Δy| y |Δh| ≤ 1 px frente al `measure.json` (S1, WG2). Cada rejilla tiene el mismo número de columnas y `maxSpread` 0.
2. **Recortes (bloqueante).** Cada `crop` se recorta en el golden (`boardSelector`) y en la captura (`siteSelector`). Las máscaras de desviación se pintan del mismo color en las dos imágenes. Se compara con `threshold: 0.15`: la proporción de píxeles distintos debe ser ≤ 1 % en recortes de página y ≤ 0,5 % en recortes de `/_paridad/`.
3. **Página completa.** En Componentes, Tarjetas y Sistema-Boost, con las máscaras de sus desviaciones: tamaño idéntico y diferencia ≤ 2 %.
4. **Líneas base de 390 px** (rutas sin tablero): diferencia ≤ 0,1 %, con los mismos parámetros. La primera captura y todo cambio posterior exigen la aprobación del propietario en el PR.

**Desviaciones aprobadas** (máscaras; toda máscara nueva exige una fila aquí):

| ID | Desviación | Tableros | Motivo |
|---|---|---|---|
| DV1 | caja del botón de tema | todos | X2, PZ-01 |
| DV2 | lista de enlaces de la barra lateral a partir del primer enlace sin ruta, más «Aportar al mapa» | todos los de 1440 | PZ-04, A1, X1. La barra lateral se compara aparte contra su línea base del sitio. |
| DV3 | tabla «Mundos», que no tiene la columna «En línea» | Main, Inicio-movil | X3, PZ-05 |
| DV4 | conteos globales que dependen del tamaño del conjunto de fixtures («910 variantes», «526 normales», «384 Shiny») | Main, Pokedex, Inicio-movil | Los fixtures solo contienen las entidades del tablero. |
| DV5 | glifos de Poppins: el sitio usa los archivos autoalojados de §3.9 y los tableros los de Google Fonts | los que tienen tooltip o ficha | Otra versión del archivo puede rasterizar distinto. |
| DV6 | línea de `HomeIntro` («… sistemas y actividades…» frente a «… sistemas y guías…») | Main, Inicio-movil | X12, Q13 |
| DV7 | datos de la cabecera de Guild: «Mundo:» (solo en modo cuenta; la prueba visual corre en modo local) y el valor de «Acceso:» («solo este navegador» frente a «Leader y Vice-Leader») | Guild | §10.4, §10.5, X9 |
| DV8 | botón «Metas» junto a «Importar export», que el tablero no tiene | Guild | X10, A14 |
| DV9 | etiqueta del botón de la fila de búsqueda: «Crear anuncio» (fase A) frente a «Publicar anuncio» (fase B, la del tablero) | Comercio | §9.5.1, PZ-08. El build visual no puede activar la fase B (necesita Supabase). |

### 14.6 CI (`.github/workflows/ci.yml`)

| Trabajo | Runner | Pasos |
|---|---|---|
| `quality` | `ubuntu-latest` | `pnpm install --frozen-lockfile` → `pnpm ci` |
| `browser` | `ubuntu-latest`, `needs: quality` | instalar → `pnpm exec playwright install --with-deps chromium webkit` (WebKit para el proyecto `webkit-mobile`) → `pnpm build` → `pnpm test:e2e` |
| `visual` | `windows-latest`, `needs: quality` | instalar (`pnpm/action-setup@v4`, Node 22.16.0) → `pnpm exec playwright install chromium` → `pnpm test:visual`. Sube `test-results/` como artefacto si falla. |

- `retries: 2` en CI solo para `browser`; `visual` y `perf` corren con `retries: 0` para no ocultar diferencias intermitentes.
- `forbidOnly` activo en CI (ya lo está en `playwright.config.ts:6`).

---

## 15. Fuera de alcance y trabajo futuro

| Tema | Qué queda fuera | Condición para abrirlo |
|---|---|---|
| Mapa interactivo (A11) | El explorador, los pisos (el piso 7 es la superficie, Q1), los marcadores con tooltip, la búsqueda por coordenadas y la página de aportes `/{l}/mapa/aportar/`, que vuelve con un canal de envío real y la línea de privacidad de R-03. Los puntos 49–58 de §12.20 son sus criterios de aceptación. | Decisión del propietario. |
| Auto-actualizaciones | Una Action que publique en Cambios el changelog del launcher; `/api/mundos` en vivo para la columna «En línea» de la tabla de Mundos (X3, PZ-05); historial de población de mundos en Supabase (R10). | Corte propio. Hasta entonces Cambios se llena a mano (§8.7) y la tabla de Mundos solo lista nombres (X3). |
| Pasarela de pago (D-009) | Cobro de promoción y de funciones del sitio. Nunca intermedia tratos entre jugadores. Los anuncios promocionados irán etiquetados y no alterarán el orden por valoración. | Decisión del propietario y revalidación de los términos de PokeAlliance. |
| Tema claro | Tokens y pruebas de un segundo tema y el botón de tema (X2, PZ-01). | Respuesta a Q6. |
| Localización de datos del juego | Traducción de misiones, rotaciones, descripciones de ítems y ubicaciones (hoy en inglés con `lang="en"`). | Datos del propietario en `content/`. |
| Espejo de medios | Copia local del arte de Pokémon que hoy se enlaza desde `wiki.pokealliance.com` (`src/lib/content/pokemon-media.ts:1`). | Derechos de redistribución (UK-006). |
| Metadatos enriquecidos | `og:image` por página y JSON-LD. | Cuando exista arte propio o espejo. |
| Idiomas adicionales | pt-BR u otros; detección por `Accept-Language` en `/`. | Decisión del propietario. |
| Supabase remoto | Aplicar migraciones remotas, entre ellas `20260918220000_remove_provenance.sql`, que permite borrar `GS:179-188`. | Autorización explícita del propietario; nunca la aplica un agente. |
| Publicación | Commit, push y despliegue. | Los hace o autoriza el propietario. |
| Medición de campo | RUM o analítica de rendimiento. | Sin analítica mientras el propietario no la pida. |
| Páginas nuevas de la wiki | Páginas de ítem, movimiento, ubicación y Mundos; guías editoriales en `/{l}/guias/` y equipos por elemento en `/{l}/rotaciones/`, rutas que hoy redirigen (E1, E2). | Decisión del propietario y datos en `content/`. |
| Comercio después de la fase B | Anuncios de compra; respuesta del vendedor a una reseña y reseña al comprador; avisos por correo. | Decisión del propietario tras el lanzamiento de la fase B. |
| Guild y Comparar | Lista de altas y bajas de Guild (E7); reordenar columnas en Comparar. | Decisión del propietario. |
| Transiciones de página | View transitions entre documentos (T4). | Un tablero o una regla del DS que las defina. |
| Ancho completo | `layout-main-full`: el token existe en el DS y ninguna pantalla lo usa (DP6). | Un tablero que lo use. |

## 16. Selectores, ranuras y filtros (revisión del propietario, 2026-09-23)

El propietario revisó la vista previa y pidió componentes a la altura del juego: cada entidad se ve con su sprite y se elige en una rejilla, no escribiendo su nombre; los filtros responden preguntas reales (tipo, tipo de moveset, tier); y la página debe ahorrar ir al juego a consultar. Esta sección gana sobre §7, §8.2, §8.5, §8.8, §9.4, §9.5 y §9.7 cuando chocan.

### 16.1 Principios

1. **La entidad es su sprite.** Un ítem, ball, held, aura, addon, stone o Pokémon que aparece dentro de un componente se dibuja como `EntitySlot`: la ranura del juego con el sprite y nada más. Nombre, descripción, precio NPC, obtención y demás datos salen en el tooltip del juego (§7.5) al pasar el puntero, enfocar o tocar. El nombre solo se escribe como texto donde el nombre es el contenido (títulos, la columna «Nombre» de una Lista, la ficha).
2. **Elegir una entidad del juego es abrir una rejilla** (`EntityPicker`, §16.3), nunca un campo de texto libre, un `Select` simple ni una fila de botones. El disparador enseña lo elegido con sus sprites; el panel tiene búsqueda en vivo, filtros propios de la entidad y teclado completo.
3. **Una sola o varias se nota a la vista:** la elección única reemplaza y cierra; la múltiple marca cada ranura elegida con una palomita, cuenta «3 elegidas» y deja las elegidas en una bandeja con su botón de quitar.
4. **Un componente por tipo de entidad, el mismo en todo el sitio:** el selector de Pokémon del formulario de Comercio es el de los filtros de Comercio, del Comparador futuro y de cualquier otro lugar que elija Pokémon. Igual con ítems.
5. **El sitio hace el trabajo:** los registros de `content/` guardan categoría, tier, ranura de held y tipo de moveset; el usuario nunca escribe un nombre que el registro ya conoce.
6. **Nada de controles de relleno:** un filtro con menos de dos valores presentes no se dibuja (C-R5); una rejilla sin datos muestra su vacío, no ranuras falsas.

### 16.2 Datos

#### 16.2.1 Jerarquía de tiers

Del mejor al peor: **ULTIMATE, Mythic, Legendary, Ultra Rare, Super Rare, T1, T2, T3, T4, T5, T6, T7.** El cliente lo confirma para los especiales (en el buscador de hunts, 8 = Super Rare, 9 = Ultra Rare, 10 = Legendary, 11 = Mythic, por encima de los numéricos) y el roster para los numéricos (T7 son Caterpie, Weedle, Magikarp; T1, finales Shiny de nivel 120). ULTIMATE, que no está en el cliente, reúne a los legendarios (Articuno, Mewtwo, Lugia…) y va arriba; el propietario puede corregirlo.

- `$defs.tierEspecial` de `content/schemas/pokemon.schema.json` pasa a ser una jerarquía, de menor a mayor: Super Rare, Ultra Rare, Legendary, Mythic, ULTIMATE (el orden actual).
- `src/lib/content/tier-rank.ts` (seguro para islas): `tierRank(tier)` (0 = el mejor), `compareTierRank` y la lista ordenada. Todo lo que ordena por tier la usa: grupos de la Tier list, opciones del filtro «Tier», orden «Tier» de las listas.
- `TierBadge` (§16.3.6) da a cada tier su color.

#### 16.2.2 Tipo de moveset

`elementoMoveset` (ya en el esquema) es el elemento que define el moveset del Pokémon para cazar:

1. se cuentan sus movimientos de área por elemento y gana el de más movimientos;
2. sin movimientos de área, se cuentan todos sus movimientos de daño;
3. un empate lo gana el elemento empatado que sea uno de los tipos del Pokémon; si ninguno lo es, el primero en el orden de movimientos del juego;
4. un valor escrito a mano gana: el importador nunca lo pisa sin la orden del propietario.

Ejemplos del propietario: Shiny Tauros (tipo Normal, casi todo su daño de área es Dark) → Dark; Eevee (un solo ataque de área, Fairy) → Fairy; Magikarp (sin área, sus ataques son Water) → Water. Mientras no llegue la exportación del cliente el campo es `null` («—») y su filtro no aparece (C-R5).

`content/moves.json` gana `alcance`: `"area"`, `"objetivo"`, `"pasivo"` o `null` (las etiquetas aoe / target / passive del Pokédex del juego), para que el importador aplique la regla y la ficha marque los movimientos de área.

#### 16.2.3 Held items y Mega Stones

- Cada ítem de `content/items/helds.json` lleva `held` obligatorio: `{ "ranura": "x" | "y", "efecto": "X-Attack", "tier": 1…8 }`. `efecto` es el nombre canónico del efecto sin el tier; `tier` es un entero de 1 a `HELD_TIER_MAX = 8`. Así cada tier es su propio ítem (X-Attack T1, X-Attack T2…), como en el juego, y el tier se puede filtrar y ordenar. `HELD_TIER_MAX` baja de 99 a 8 (Q8, respuesta del propietario: «pon que 8»).
- Un ítem de cualquier categoría puede llevar `mega`: `{ "pokemon": ["charizard", …] }` (ids de `content/pokemon.json`; lista vacía si no se sabe cuál). Marca una Mega Stone.
- Un Pokémon lleva como mucho: una ball, varias auras, varios addons, un held X, un held Y y una Mega Stone.

#### 16.2.4 Auras

`content/auras.json` tiene las siete auras del cliente, con su nombre del juego: Premier, Alliance, Christmas 2024, Halloween 2025, Solo Leveling, Digimon Red Aura y Killua God Speed (ids `premier`, `alliance`, `christmas-2024`, `halloween-2025`, `solo-leveling`, `digimon-red-aura`, `killua-god-speed`). El cliente no trae iconos de aura: se ven en el juego como un anillo con el sombreador del aura. Mientras el propietario no aporte los suyos, cada aura usa un anillo de color propio generado desde el anillo del cliente (`ui/auras/<id>`, marcado `borrador` en `sprites.json`), y el icono se cambia en el registro sin tocar código.

#### 16.2.5 Anuncio (sustituye a `UnidadPokemon` de §9.4)

```ts
type UnidadPokemon = {
  pokemon: string;                 // id de content/pokemon.json
  ball: string | null;             // id de un ítem de poke-balls
  auras: string[];                 // ids de content/auras.json, sin repetir
  addons: string[];                // ids de los addons de ese Pokémon (content/outfits.json)
  heldX: string | null;            // id de un ítem con held.ranura = "x"
  heldY: string | null;            // id de un ítem con held.ranura = "y"
  mega: string | null;             // id de un ítem con mega
  boost: number | null;            // 0–50
  starLevel: number | null;        // 0–5
  nickname: string | null;         // ≤ 40
  memorySlots: number | null;      // 1–6, solo Ditto y Shiny Ditto
  memorias: (string | null)[];     // largo = memorySlots; ids del roster
  nextBoostChance: string | null;  // "0"–"100", ≤ 2 decimales
  entrenamiento: { habilidad: Habilidad; nivel: number | null; progreso: string | null }[];
  precioNpc: { tipo: 'unsellable' } | { tipo: 'pokedolares'; cantidad: number } | null;
};
// Anuncio de ítem: item: { item: string; cantidad: number } — id del registro, sin nombre declarado.
```

- Los nombres declarados de texto libre desaparecen (R2 queda solo para registros viejos): ball, held, addon e ítem se eligen del registro. El tier de un held sale de su ítem.
- La fase B valida esta forma en el servidor con una migración nueva que reemplaza la validación del activo de §9.12.3 (nunca se reescribe una migración ya creada).
- El registro de demostración (`tests/fixtures/comercio/`), su esquema, `content:check`, `listingTitle`, `listingText`, la búsqueda y el fixture visual pasan a la forma nueva.

### 16.3 Componentes

#### 16.3.1 `EntitySlot`, la ranura estándar

La ranura del juego: cuadrado oscuro con borde de 1 y esquinas de 4, como `pokemon_background.png` del cliente, con el sprite centrado a escala entera. Tamaños 32, 40, 48, 64 y 72 (objetivo táctil 44). Estados: reposo, puntero (borde más claro), foco visible (anillo de foco), elegida (borde de acento y brillo interior, como la ranura elegida del juego), no disponible (atenuada con el candado del cliente). Marcas en las esquinas, cada una opcional: palomita arriba a la derecha (elegida en una elección múltiple), `ShinyMark` arriba a la derecha (si no hay palomita), `TierBadge` mini arriba a la izquierda, cantidad abajo a la derecha. Abre el tooltip de su entidad (§7.5.10).

#### 16.3.2 `EntityPicker`, el selector genérico

- **Disparador**, con el aspecto de un campo (etiqueta encima, borde, altura 48):
  - vacío: una ranura de contorno punteado y el texto «Elegir Pokémon» / «Choose Pokémon» (o la entidad que sea);
  - elección única: la ranura con el sprite y, a su lado, el nombre en texto secundario;
  - elección múltiple: las ranuras elegidas en fila (sin nombres) y «+N» si no caben;
  - botón «Quitar» (×) cuando el campo es opcional y hay algo elegido.
- **Panel:** desde 768, un popover anclado al disparador (`@floating-ui/dom`, ya cargado bajo demanda, D-021) de al menos 640 de ancho y hasta 480 de alto; por debajo, una hoja inferior a pantalla completa con el mismo contenido.
  1. **Búsqueda** con el foco al abrir; filtra mientras se escribe, sin acentos ni mayúsculas, por nombre, alias y número («#6», «6»); muestra la cuenta de resultados.
  2. **Filtros** de la entidad (§16.3.3), como chips con sprite o icono; dentro de un filtro, cualquiera de los elegidos (O); entre filtros, todos (Y). «Limpiar filtros» cuando hay alguno.
  3. **Rejilla** de `EntitySlot` de 48 en columnas automáticas, con el orden de la entidad. Se pinta por tandas (las primeras 120 y el resto al desplazarse) para que abrir y escribir respondan en menos de 200 ms.
  4. **Panel de detalle** acoplado, a la derecha desde 1024 y como franja inferior por debajo: el contenido del tooltip de la ranura bajo el puntero o el foco (§7.5.2). Dentro del panel las ranuras no abren un tooltip flotante: el detalle ocupa su lugar.
  5. **Elección múltiple:** una bandeja arriba con las elegidas (cada una con quitar), la cuenta «N elegidas» y el botón «Listo».
- **Teclado:** flechas entre ranuras (fila y columna), Inicio/Fin, RePág/AvPág, Intro o Espacio elige, escribir va a la búsqueda, Esc cierra y devuelve el foco al disparador.
- **Accesibilidad:** el disparador es un botón con `aria-haspopup="dialog"` y `aria-expanded`; la rejilla es `listbox` (`aria-multiselectable` en la múltiple) con `aria-activedescendant`; cada ranura es `option` con `aria-selected` y el nombre de la entidad como nombre accesible.
- **Opción «Ninguno»** (elección única y opcional): primera ranura, con el icono de «sin elección» del cliente (`none_background.png`), como el panel de auras del juego.
- **Vacío:** «No hay coincidencias.» con «Limpiar filtros».
- **Carga:** el código del panel se carga al abrirlo por primera vez (`import()`, ≤ 60 KB gzip); los datos, del `datos.json` de la entidad (PR5). Mientras llegan, el panel muestra su esqueleto con la altura final.

#### 16.3.3 Selectores de cada entidad

| Selector | Datos | Filtros del panel | Orden | Única / múltiple |
|---|---|---|---|---|
| `PokemonPicker` | `/{l}/pokedex/datos.json` | Tier (chips en el orden de §16.2.1, con `TierBadge`), Tipo (los 18 iconos de elemento), Tipo de moveset (iconos; oculto sin datos), Variante (Normal / Shiny con `ShinyMark`), Generación | Número de Pokédex; la normal antes que la Shiny | las dos |
| `ItemPicker` | `/{l}/items/datos.json` | Categoría (pestañas con el sprite de categoría del Market) cuando admite más de una; sus propios filtros cuando los tiene | El del registro | las dos |
| `HeldPicker` | ítems con `held` | Ranura fija (X o Y), Tier 1–8 | Matriz: una fila por `efecto`, una columna por tier; la búsqueda filtra filas | única |
| `MegaPicker` | ítems con `mega` | — | El del registro; primero las del Pokémon elegido | única |
| `AuraPicker` | `content/auras.json` | — | El del registro | múltiple |
| `AddonPicker` | addons del Pokémon elegido | — | El del registro | múltiple |

- **Ranura de un Pokémon:** su outfit del juego (el sprite de `content/outfits.json` hacia el sur y quieto) cuando existe; si no, su retrato (`imagen`) dentro de la ranura. Con `ShinyMark` en las Shiny.
- **`AuraPicker` y `AddonPicker`** tienen pocas opciones y se dibujan en línea, sin popover: una rejilla de ranuras de 56 bajo su etiqueta, como el panel «Auras» del juego (primera ranura «Ninguna», que vacía la elección; las elegidas con borde de acento y palomita). `AddonPicker` se oculta si el Pokémon no tiene addons y espera a que haya Pokémon.
- **`HeldPicker`** es la matriz efecto × tier: se ve de un vistazo qué efectos existen y en qué tiers; una columna sin ítems no se dibuja.

#### 16.3.4 Otros controles

- **Star Level:** cinco estrellas pulsables con los sprites de estrella del cliente (`selected_star.png`, `empty_star.png`); pulsar la estrella elegida la quita.
- **Boost:** control de pasos (−, valor, +) con un deslizador de 0 a 50.
- **Mundo** (formulario y filtros de Comercio): chips con el nombre de cada mundo de `content/mundos.json`, no un `Select`.
- **Tipo de activo** del formulario: cuatro fichas grandes con sprite (un Pokémon, la mochila de ítems, el diamante, la moneda) y su nombre, no pestañas de texto.

#### 16.3.5 `ShinyMark`

Usa el icono Shiny del cliente (`ui/shiny`, de `game_pokedex/images/shiny_icon.png`) en lugar del glifo actual, que el propietario no reconoce como Shiny. Donde se escribe «Variante: Shiny», el icono va delante.

#### 16.3.6 `TierBadge`

Pastilla con el tier («T1», «Super Rare»…) y un color por escalón de la jerarquía (§16.2.1): los numéricos en grises de más claro (T1) a más apagado (T7) y cada especial con su token (`--tier-super-rare`, `--tier-ultra-rare`, `--tier-legendary`, `--tier-mythic`, `--tier-ultimate`) definido en los tokens del tema, con contraste AA sobre su fondo. Lo usan `DexCard`, las ranuras (en mini), los filtros y la Tier list.

### 16.4 Páginas

#### 16.4.1 Ítems (§8.5)

- **Dos vistas:** «Ranuras» (por defecto) y «Lista». La vista Cards desaparece de esta página (su `ViewToggle` ofrece dos).
- **Ranuras = el inventario del juego:** un panel oscuro con una rejilla de ranuras de 48 pegadas (separación 2), sin tarjetas; en «Todo», un bloque de inventario por categoría con su sprite y nombre como cabecera. Cada ranura es el sprite y nada más; puntero, foco o toque abren el tooltip completo del ítem (nombre, categoría, elemento, uso, precio NPC, precio de tienda, «Drop de», «Se obtiene en» cuando haya datos). Mayús fija el tooltip (§7.5.9).
- **Lista:** la tabla de hoy (sprite, nombre, categoría y las claves de la unión).
- **Búsqueda en la página:** campo «Buscar ítem» que filtra en vivo el inventario y la lista.
- **Tamaño de página:** 96 ítems.

#### 16.4.2 Pokédex (§8.2)

- **Filtros:** «Tipo» (iconos de elemento, varios), «Tipo de moveset» (iconos, varios; oculto sin datos), «Tier» (chips en el orden de §16.2.1, varios), «Variante» (Normal / Shiny con `ShinyMark`) y «Generación». Los mismos chips que el panel de `PokemonPicker`, en el mismo orden. En la URL: `?tipo=fire,water&moveset=dark&tier=t1,legendary&variante=shiny&gen=3` (el parámetro `elemento` de hoy se sigue leyendo como `tipo`).
- **Orden** (`SortSelect`): «Número» (por defecto), «Nombre», «Tier (mejor primero)», «Requisito».
- **Hechos:** «Moveset» con el chip de su elemento, y el tier con `TierBadge`.

#### 16.4.3 Tier list (§8.8)

- **Orden:** del mejor al peor (§16.2.1): ULTIMATE arriba y T7 abajo.
- **Vista por defecto «Ranuras» como una tier list clásica:** una fila por tier, con la etiqueta del tier en una celda de color a la izquierda (el color de `TierBadge`) y las ranuras de sus Pokémon a la derecha, saltando de línea. Esta vista muestra toda la lista sin paginar (las imágenes fuera de pantalla cargan tarde); Cards y Lista siguen con 48 por página.
- **Filtros:** los de la Pokédex salvo «Tier» (las filas son los tiers).

#### 16.4.4 Crear anuncio (§9.7)

La disposición de §9.7.1 se queda (formulario y vista previa fija). El formulario pasa a ser guiado:

1. **«¿Qué vendes?»:** las cuatro fichas de §16.3.4.
2. **Pokémon:**
   - «Pokémon»: `PokemonPicker` (única, obligatorio). Al elegirlo, la vista previa se pinta con su sprite.
   - «Ball»: `ItemPicker` de poke-balls (única).
   - «Auras»: `AuraPicker` (múltiple, en línea).
   - «Addons»: `AddonPicker` (múltiple, en línea).
   - «Held X» y «Held Y»: un `HeldPicker` cada uno; «Mega Stone»: `MegaPicker`. No hay campo «Tier» aparte.
   - «Boost», «Star Level» (§16.3.4), «Nickname», «Next Boost chance».
   - Ditto: «Memory Slots» con el control de pasos (1–6) y una ranura `PokemonPicker` por memoria.
   - «Entrenamiento»: tabla compacta de las 8 habilidades con nivel (control de pasos) y progreso (%), con `TrainingMeter` como vista.
   - «NPC Price»: como hoy.
3. **Ítem:** `ItemPicker` de todas las categorías (única) y «Cantidad».
4. **Diamonds / Pokédólares:** la cantidad con su sprite y la cifra exacta en vivo (como hoy).
5. **Precio** (§9.7.4) y **Mundo** (chips).
6. **Acciones:**
   - con `COMERCIO_PUBLICO`: la acción principal es «Publicar anuncio» (§9.7.8), con el consentimiento de dinero real (§9.15.2) cuando el precio lo tiene; sin sesión, «Inicia sesión para publicar» con el botón «Iniciar sesión»; sin cumplir un requisito, la línea nombra el que falta (registro sin terminar, menor de 18, Discord con menos de 60 días, sin canal visible, suspensión) y enlaza a donde se arregla;
   - «Copiar texto para Discord» / «Copy text for Discord» queda siempre como acción secundaria (el texto de §9.7.7); sin `COMERCIO_PUBLICO` es la única.
7. La vista previa es la `ListingCard` real, con ball, auras, addons, helds y Mega Stone como ranuras con tooltip (§16.4.5).

#### 16.4.5 Tarjeta, fila y detalle del anuncio

El equipo del Pokémon (ball, auras, addons, held X, held Y, Mega Stone) se dibuja como una tira de `EntitySlot` de 32, sin nombres y con su tooltip, en el orden del juego. `HeldStrip` pasa a esta tira. El tier del held sale en su tooltip y como marca mini de la ranura.

#### 16.4.6 Filtros de la lista de Comercio (§9.5.4)

Se añaden «Pokémon» (`PokemonPicker` múltiple, con sus filtros de tipo, moveset y tier dentro del panel) e «Ítem» (`ItemPicker` múltiple). «Mundo» pasa a chips. En la URL: `?pokemon=charizard,shiny-charizard&item=fire-stone`.

### 16.5 Criterios de aceptación

1. El formulario de Comercio no tiene ningún campo de texto libre ni `Select` simple para una entidad del juego: Pokémon, ball, auras, addons, helds, Mega Stone, ítem y memorias se eligen en su selector con sprites.
2. `PokemonPicker`: «char» deja Charmander, Charmeleon, Charizard y sus Shiny; «#6» da Charizard; Tier, Tipo, Tipo de moveset, Variante y Generación se combinan (O dentro de un filtro, Y entre filtros); la rejilla sigue el número de Pokédex; flechas, Intro y Esc funcionan; abrir el panel responde en menos de 200 ms.
3. `AuraPicker` y `AddonPicker` admiten varias, marcan cada elegida con palomita y «Ninguna» vacía la elección.
4. «Held X» solo ofrece ítems con `held.ranura = "x"` en la matriz efecto × tier; el anuncio guarda el id del ítem y su tier sale del registro.
5. La página de Ítems ofrece solo «Ranuras» y «Lista»; en Ranuras ninguna tarjeta envuelve a un ítem y cada ranura abre el tooltip.
6. La Tier list empieza por ULTIMATE y termina en T7; el filtro «Tier» de la Pokédex y de `PokemonPicker` sigue ese orden.
7. Toda variante Shiny muestra el icono Shiny del cliente.
8. Con un registro de prueba que tiene `elementoMoveset`, `?moveset=dark` deja solo esos Pokémon, y combinado con `?tipo=normal` deja los Normal con moveset Dark.
9. Con `COMERCIO_PUBLICO` la acción principal del formulario es «Publicar anuncio»; sin sesión pide iniciarla; «Copiar texto para Discord» es secundaria.
10. Ningún límite de §13.6 sube.
