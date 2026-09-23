# Plan de contenido de Alliance Codex

Fecha: 2026-09-18. Es un plan: no cambia nada del repositorio. Se apoya en los tres inventarios de esta sesión (hoja comunitaria + DOCX, wiki oficial-candidata y fuentes comunitarias) y en el contrato del repo: `AGENTS.md`, `docs/DATA_STRATEGY.md`, `docs/DATA_MODEL.md`, `docs/GAME_KNOWLEDGE_EXPANSION_PLAN.md` y `supabase/migrations/*`.

**Actualización del 2026-09-18 (D-011, D-012):** el propietario decidió cargar los datos a mano en registros JSON de `content/` y eliminar la procedencia de todas partes. Se reescribieron las partes del plan que dependían de ella: reglas generales, §3.1, §3.3, §3.5, §4.1, requisitos de cierre, H0 y los anexos. Ya no hay claims, `basis`, linajes, muestreo por lote, staging ni registro de fuentes; las fuentes de este plan sólo ayudan al propietario a decidir valores.

Revisión escéptica del 2026-09-18: contrastado con `AGENTS.md`, el repo, `.gitignore` y las respuestas del propietario del 2026-09-18 [C0]. Las etapas de ingesta se llaman **hitos H0–H9** para no confundirlas con el «Corte 0» del sistema de diseño [D-010].

**Qué propone:**
- Sustituir las muestras de investigación que hoy muestran Guías, Sistemas y Rotaciones por páginas completas, basadas en datos reales y organizadas como el índice de RubinOT: Destacados, Sistemas, Ítems, Actividades, Pokédex, Herramientas, Comunidad y Mundos.
- La wiki oficial-candidata ya permite publicar casi todo Sistemas y Actividades.
- La hoja comunitaria es la única fuente de drops, zonas de spawn, NPC por Pokémon y dens. Toda la hoja y sus copias cuentan como **una sola referencia**, y nada de ella se publica sin visto bueno del propietario ni sin respuesta sobre derechos.

**Cómo leer las citas:**
- **Oficial:** la wiki del juego; sus páginas no se citan [D-012].
- **[L:feed]** `https://pokealliance.com/launcher/feed`, con 20 entradas del 2026-07-11 al 2026-08-20. **[L:players]** es `/launcher/players`.
- **[S:Pestaña!Celda]** la hoja comunitaria «Pokedex pública», copia de la hoja superior `1ID3qu1P4Zey82OSLntg4O0xoZlY1hGK58tte0D_Cv_s`, a la que no tenemos acceso.
- **[D:párr. N]** el DOCX «Times iniciantes Hoenn».
- **[C:…]** fuentes comunitarias:
  - `thiagobfo@0135ccd`, `pkaguide@3d16ef4`, `wiki-pka`, `Nrzty@12cf070`, `pmassambani@5142792`, `Gmatheusux@9338d9e`: copias o derivados de la hoja, salvo Gmatheusux.
  - `CriticalCatch`: registros de jugadores, independiente de la hoja.
  - `PokeForge`: calculadora.
- **[R]** `content/pokemon.json`, 910 variantes.
- **[I-S] / [I-W] / [I-C]** los inventarios de hoja, wiki y comunidad (salidas en `content/sheet/`, `content/official/` y `content/community/`).
- **[N:items] / [N:unit] / [N:addons]** las notas previas en `scratchpad/wf/research-*.md`.
- **Repo:** [DM] `docs/DATA_MODEL.md`, [GKEP] `docs/GAME_KNOWLEDGE_EXPANSION_PLAN.md`, [DS] `docs/DATA_STRATEGY.md`, [AG] `AGENTS.md`, [D-010]/[D-011]/[D-012] `docs/DECISION_LOG.md`, [CS] `docs/CURRENT_STATUS.md`, [RU] `docs/RISKS_AND_UNKNOWNS.md`, [CI] `docs/CHANGELOG_INGESTION.md`, [C0] respuestas del propietario en `docs/CORTE_0_CODEX_TOOLTIP_SPEC.md` §1.5 (A1–A22, Q1–Q5).

**Reglas que se aplican en todo el plan:**
- Sin procedencia [D-012]: no se guardan ni muestran fuentes, evidencias, estados de verificación, fechas de consulta ni hashes. Ante dos valores, el propietario elige; la wiki oficial es la primera referencia.
- Lo desconocido no es 0. En la hoja, `?`, `-`, `~` y las celdas vacías significan desconocido, «sin dato» o aproximado [I-S §7].
- Los nombres de juego canónicos van en inglés, con alias en pt y es.
- Lo desconocido se guarda como `null` y se muestra `—`; los registros de relleno llevan `"borrador": true` [D-011].
- Nada de texto de relleno [D-010].
- Orden de fases: ningún hito adelanta una fase posterior [AG]. El orden de etapas de [GKEP] (B → C → D → E → F) solo cambia con una decisión registrada en `docs/DECISION_LOG.md` (§4.2).
- Lo que lee el sitio público es `content/*.json` (`src/lib/content/repository.ts`), no Supabase. Los contratos JSON van antes que la migración (§3.1).

---

## 1. Arquitectura de información

### 1.1 Tipos de página

| Tipo | Uso | Estructura mínima | Qué no lleva |
|---|---|---|---|
| **Portada** | Entrada y búsqueda | Buscador (Ctrl K); panel Destacados; siete paneles índice con conteo de entidades publicadas; tabla de mundos; Server Save; sprites del juego como íconos [C0 A3] | Hero, métricas de cobertura, CTA decorativo |
| **Índice de sección** | Navegar un dominio | Filtros y filas, agrupadas por subfamilia | Introducción genérica |
| **Ficha de entidad** | Pokémon, ítem, NPC, lugar, actividad, sistema, mundo | Cabecera con identidad y datos clave; bloques ordenados por decisión; los vacíos se omiten | IDs internos, bloque de fuentes |
| **Tabla de referencia** | Listas completas (150 Linked Tasks, costos de Stars, medallas) | Tabla ordenable con scroll interno en móvil y ancla por fila | Párrafos repetidos por fila |
| **Guía editorial** | Cómo hacer algo (primeros pasos, rotaciones) | Pasos o checklist; enlaces a entidades por ID | Prosa copiada de fuentes |
| **Herramienta** | Cálculo con datos completos | Entradas, resultado y supuestos visibles solo si cambian el resultado | Calculadoras con datos incompletos |
| **Registro** | Cambios del juego | Entradas por fecha con entidades afectadas | Texto del feed copiado íntegro |
| **Comunidad** | Contribuir, comerciar, créditos | Formulario o lista | Controles falsos |

Este plan fija solo la estructura. El aspecto visual lo decide el sistema «Codex Tooltip» [D-010], que reemplaza el contrato visual RubinOT cuando aterrice el Corte 0 visual. Ese corte se reescribirá como v2 con maquetas en Claude Design antes de implementarse [C0 §1.5], así que los hitos que construyen páginas esperan a esa v2.

Requisito de datos que impone [C0 A19]: toda lista ofrece vistas Cards, Slots y Lista, y todo ítem, Pokémon o sistema mencionado abre su tooltip del juego. Por eso cada entidad citada en cualquier página necesita un registro mínimo (nombre canónico, categoría y sprite si lo hay). Una cadena sin entidad no puede tener tooltip y no se enlaza.

### 1.2 Mapa del sitio

Las rutas actuales (`/pokedex`, `/guias`, `/sistemas`, `/rotaciones`, `/herramientas`, `/mapa`, `/buscar`, `/comercio`, `/cambios`) se conservan. Se añaden `/items`, `/actividades`, `/mundos` y `/comunidad`. Los slugs de entidad son canónicos en inglés e iguales en `/es/` y `/en/` [DS].

#### Portada — `/{l}/`
- Buscador global: Pokémon, ítems, NPC, lugares, actividades y sistemas, con alias en pt, es y en.
- Panel Destacados.
- Siete paneles índice con 5–8 enlaces fijados por el propietario y el conteo de entidades publicadas de cada sección [C0 A3]. No hay analítica de uso, así que «los más usados» no se puede afirmar.
- Server Save en hora local con cuenta regresiva (regla candidata `00:00 America/Sao_Paulo`, UK-009 [DM §5], [C0 A17]).
- Tabla de mundos [C0 A3] (ver H. Mundos; la población depende de P10).

#### A. Destacados (panel de portada, sin índice propio)

| Pieza | Propósito | Vigencia |
|---|---|---|
| Temporada GamePass actual | Qué da la temporada y cuándo acaba | La temporada capturada termina el 2026-09-30, casi seguro antes de que salga este panel: se vuelve a capturar la temporada vigente en H2 |
| Últimos cambios (3 entradas) | Enlace al registro [L:feed] | Rotación automática |
| Contenido nuevo | Hoenn 250+, abierto el 2026-08-19, y mundos Titan, abiertos el 2026-08-21 [L:feed] | Se retira a los 60 días (propuesta) |
| Accesos rápidos | Linked Tasks, calculadora de Stars, Primeros pasos | Fijos hasta que el propietario los cambie |
| `/cambios/` | Historial del feed por entrada, con entidades afectadas | Permanente |
| `/guias/` | Índice de guías editoriales (Primeros pasos, orientativa y sin cifras; Teleport; Fly/Surf/Ride como guía de uso) | Permanente |

Cada Destacado es un registro con `effective_from` y `effective_to` que enlaza a una página existente. Nunca es texto suelto.

#### B. Sistemas — `/sistemas/`, `/sistemas/{slug}`

| Grupo | Páginas (slug propuesto ← fuente) | Propósito |
|---|---|---|
| Progresión del Pokémon | `boost`; `stars`; `mega` (sin página oficial propia: reúne la incompatibilidad con Stars, `!automega`, las Sealed Mega Stones y las variantes `mega` de [R]); `helds`; `training`; `talents`; `pokelog-runes`; `medals`; `hazard` | Reglas, costos por nivel, límites e incompatibilidades, cada uno junto a su calculadora si la hay |
| Personaje | `experience`; `achievements`; `vip`; `outfits`; `prey` | Progreso de cuenta y personaje |
| Captura y Shiny | `catching` (balls, brokes) ← [S:Brokes] + [C:CriticalCatch]; `shiny-tiers` | Qué ball usar, qué esperar, dónde aparecen los Shiny especiales |
| Economía | `currencies` (Pokédólares en k/kk, Diamonds, Online Points, Twitch Points, tokens) ← [N:items §3]; `market` ← [L:feed]; `online-shop`; `twitch-shop`; `jully-tv-cam`; `houses`; `global-buff`; `calendar`; `gamepass` | Cómo se gana y se gasta cada moneda |
| Movilidad y utilidades | `fly-surf-ride`; `teleport` ← [L:feed] 2026-08-09; `hunt-analyzer`; `hunt-stash`; `task-tracker`; `pokemon-census`; `commands` | Referencia de uso |
| Social | `guild` (con las correcciones de [L:feed] 2026-08-09/10); `duel` | Reglas, costos y límites |

Queda fuera `guias/teste`: es basura publicada, con una imagen de otro juego y otra que da 404 [I-W].

#### C. Ítems — `/items/`, `/items/c/{categoría}`, `/items/{slug}`
- **Índice:** buscador y filtros por categoría, más la acción «quién lo dropea / dónde se usa». Esto sustituye a una herramienta separada de «búsqueda inversa».
- **Categorías:** las 14 del Market del cliente, en su orden, fijadas por D-011: Todo, Diamantes, Pokémon, Poké Balls, Stones, Helds, Orbs, Creature Items, General Items, Utilities, Addons, Consumable, Foods y Furnitures. `tokens` queda como agrupación editorial.
- **Addons, auras y costumes:** no hay catálogo público. Solo constan nombres sueltos (5 Costumes del GamePass, «Hunter X Hunter Especial Aura») y se cambian en la ventana Customize [N:addons §0]. Sin capturas (P4) no hay página de categoría.
- **Ficha de ítem**, en este orden [GKEP «Ficha de item»]:
  1. Para qué sirve.
  2. Cómo se obtiene: drops, dens, tasks, tiendas y quests.
  3. Cuánto se necesita.
  4. Precio NPC, si existe.
  5. Alternativas.

#### D. Actividades — `/actividades/`, `/actividades/{slug}`

| Página | Propósito |
|---|---|
| `linked-tasks` (tabla de 150) | Secuencia completa: objetivo, cantidad, área, recompensas de primera vez y de repetición, kills/h estimado |
| `world-tasks` + `world-tasks/{npc}` | 167 tasks de NPC por región, con etapas y recompensas |
| `hazard-tasks` | 17 NPC de Hoenn con requisitos Shiny |
| `mega-dens` | 36 especies Mega Den; Sealed Mega Stones en Hazard 5/10 |
| `gyms` + `gyms/{city}` | 8 gyms: tasks, reglas del dungeon, líder y equipo, medalla |
| `rocket-weekly` / `police-weekly` | 13 + 13 entrenadores, límites, tokens; Giovanni y Jenny a las 130 victorias |
| `arcane-dens` + `arcane-dens/{family}` | 18 familias × dificultad: niveles, mobs, XP, recompensas |
| `clones` | Mewtwo Clones: 3 dificultades, buffs, canje de tokens |
| `quests` + `quests/{slug}` | 7 quests: Captain Willy, Lucky Amulet, Flint, Dr. Vektor, Hoenn Access, Orange Islands, Dr. Oliveira (Shiny Ditto) |
| `expeditions` | PokeExpedition: slots y tiempos base |
| `bounty-contracts` | Contratos BH. **Retenida**: solo hay nota comunitaria [S:BH] |
| `events` | Eventos temporales tomados del feed, con vigencia |

Los dailies y bosses de guild viven en `/sistemas/guild`. Actividades solo los enlaza.

#### E. Pokédex — `/pokedex/`, `/pokedex/{slug}`, `/pokedex/tiers/`, `/rotaciones/`, `/rotaciones/{element}`
- **Ficha de variante**, orden según [GKEP «Ficha de Pokémon»]:
  1. Identidad, tier y rol, elementos, nivel requerido.
  2. Disponibilidad y zonas.
  3. Moveset.
  4. Loot.
  5. Evolución y requisitos.
  6. Usos en sistemas: Boost, Talents, Medals.
  7. Tasks que lo piden.
  8. Velocidades de Fly/Surf/Ride.
- **`/pokedex/tiers/`** (nueva): tiers oficiales por variante, elemento del moveset y tiers Shiny especiales (Primal Areas). Solapa con el explorador de tiers de `/herramientas/pokemon`, que se rehará por completo [C0 A13]: debe quedar una sola superficie de tiers (P19).
- **`/rotaciones/`:** equipos por elemento. Es una recomendación de la comunidad con créditos (§4.1). Queda agrupada bajo Pokédex en la navegación. Qué es una «rotación» en PokeAlliance y qué la vuelve elegible sigue abierto (U-003 [RU]); la página no lo presenta como mecánica del juego hasta confirmarlo en la wiki oficial o en el juego.

#### F. Herramientas — `/herramientas/`
- Se mantienen `pokemon` (comparar) y `guild`.
- Se añaden solo las herramientas cuyo cálculo está cerrado:
  - `stars`: costos y daño por estrella.
  - `experience`: nivel, XP y pérdida por muerte.
  - `boost`: probabilidad por piedra y +10 pp por fallo, con rangos de fragmentos observados.
  - `linked-tasks`: planificador sobre la serie ordenada. [GKEP «Quests y progresión»] reserva el progreso personal para cuando existan Cuentas (fase posterior): sin persistencia, salvo que el propietario apruebe guardar en el navegador (P15).
- El buscador de dens y la búsqueda inversa de drops son filtros de los índices de Actividades e Ítems, no herramientas aparte.
- Quedan bloqueadas las herramientas pendientes del roadmap de la Fase 5: Hunt Finder (no hay hunts con nombre ni coordenadas, UK-010/UK-017), constructor de rotaciones y equipos (U-003 y permisos) y calculadora de Shiny (Shiny Rate sin significado, UK-013).

#### G. Comunidad — `/comunidad/`
- `comercio`, ya existente.
- `mapa/aportar` se retira con redirección a `/mapa/` y vuelve cuando el mapa interactivo esté listo [C0 A1].
- `creditos` (nueva): autores de datos comunitarios con permiso. Es atribución, no una página de fuentes; necesita visto bueno (P2).
- `faq` (nueva): respuestas reescritas por tema.
- `glosario` (nueva): jerga como DD, KK, sh, DG, hunt, broke, Tubos, rotação.
- `guias-comunidad`: guías de terceros, solo con permiso.
- Enlaces oficiales.

#### H. Mundos — `/mundos/`, `/mundos/regiones/{slug}`, `/mundos/lugares/{slug}`, `/mundos/npc/{slug}`, `/mapa/`
- **Servidores:** Moon, Sun, Titan 1, Titan 2 y Titan 3 [L:players], con fecha de apertura de Titan [L:feed]. El propietario pidió una tabla de mundos en la portada [C0 A3]; queda abierto solo cómo mostrar la población (P10).
- **Server Save.**
- **World Transfer:** retenida. La página oficial tiene 13 marcadores «a preencher».
- **Regiones:** Kanto, Johto, Hoenn (250+), Orange Islands, Wildscape (150+), Primal Areas, «Tubos» (350+) [S:FAQ!R103]. Cada una muestra ciudades, teleports, límites de nivel, hunts y NPC.
- **Fichas de lugar:** ciudades, gyms y dens.
- **Fichas de NPC:** tasks, tiendas, servicios y batallas.
- **Mapa**, existente.

### 1.3 Contenido que se retira
- Las páginas Guías, Sistemas y Rotaciones basadas en las muestras de `content/` (`quests.json`, `locations.json`, `system-items.json`, `moves.json`, `rotations.json`) se sustituyen por las fichas generadas en los hitos H2, H3 y H5 [C0 A18].
- Las muestras **no** pasan a ser fixtures: [DS «Fixtures»] exige fixtures sintéticos, con valores inventados, en `tests/fixtures/`. Cada muestra se absorbe en su colección completa (la quest de Porygon en `quests`, Saffron en `locations`) o se retira cuando esa colección exista.
- Mientras llegan H2, H3 y H5, las tres páginas siguen mostrando muestras; si se ocultan antes es decisión del propietario (P18).

---

## 2. Datos por sección: fuente, cobertura y estado

**Leyenda de «¿Publicable?»:**
- **Sí:** fuente oficial-candidata completa y sin conflicto que bloquee; solo falta redacción.
- **Parcial:** se publica un subconjunto y se omiten campos.
- **No:** bloqueado, con el motivo indicado.

«Publicable» se refiere a los datos. El trabajo de pipeline y UI va aparte (§4).

### 2.1 Pokédex (denominador: 910 variantes del roster; 914 páginas `pokemon-v4`)

| Hecho | Mejor fuente | Cobertura | Conflictos y huecos | ¿Publicable? |
|---|---|---|---|---|
| Identidad, número, variante, elementos | `pnpm content:roster` → [R] | 910/910 | Especies 530 / 526 / 507 sin resolver (C-001). Faltan Garbodor, Trubbish, Skiddo, Gogoat y sus shinies, 35 shinies (Luxray, Lucario, Tangrowth…) y 15 formas (5 Mega, Castform, Smeargle Shiny Ice/Psy) [I-S §5], [N:addons §0.6] | Sí (roster). Las faltas se tratan como entidades `pending` no públicas (P6) |
| Tier y rol | Oficial (roster y páginas) | 818 páginas con tier (89,5 %); 92 filas del roster sin tier ni rol | 27 filas muestran «1» donde el roster dice ULTIMATE (C-021). 6 difieren de [S:Tier List] (C-012) | Sí, valor oficial; el tier comunitario queda interno |
| Elemento del moveset | [S:Tier List!C] | 854 filas; 58 con `?`; 110 filas del roster ausentes (mayoría Gen 4) | Una sola fuente comunitaria; Delcatty cambió de Normal a Fairy entre junio y septiembre [I-C §3.2] | Parcial: solo en `/pokedex/tiers` y `/rotaciones`, como dato comunitario |
| Descripción | Página | 788 (86,2 %) | — | Sí (reescrita o resumida, §6) |
| HP / Experience / Required Level | Página = roster (0 discrepancias) | 914 | **85 páginas con valores por defecto 90/1575/60** (83 Gen 4, Rayquaza, model). Además, Experience = 1575 aparece en **263 filas** del roster (165 con HP distinto del de plantilla), sobre todo Gen 3 y 4: sospecha de valor por defecto [I-W `conflicts-and-quality.json` «exp-1575-suspect»] | Parcial: los 85 se publican como desconocidos, nunca como 90/1575/60. Experience = 1575 en el resto de esas 263 filas queda sin publicar hasta corroborarlo (UK-023); su HP y su nivel sí se publican |
| Moves (slot, nombre, cooldown, elemento) | Página | 803 páginas; 6.344 filas; 628 nombres | 220 páginas con slots desordenados; 12 pasivos con cooldown «N/A» | Sí (ordenar por slot; N/A = no aplica) |
| Evolución y requisitos | Página | 383 «evoluciona desde», 364 «evoluciona a», 652 menciones de ítems, 228 IDs de ítem | «No level requirement» 216 veces: es un valor explícito, no un desconocido | Sí |
| Habilidades de campo | Página | 467 (51,1 %); 11 etiquetas | «Montaria» (pt) en 50 páginas es alias de Ride | Sí (canónico, §5) |
| Velocidad Fly/Surf/Ride | Oficial | ~200 criaturas, con Shiny, Mega y Crystal Onix | — | Sí |
| Drops (lista) | [S:Drops]; corroboración independiente con [C:CriticalCatch] (10.558 mensajes de loot, 255 variantes) | 806 variantes con drops; 3.650 pares (3.644 distintos); 963 cadenas; **0 en la wiki oficial** | Erratas (`fairy esence`, `heard stone`, `snow ball`/`snowball`); 6 pares duplicados; ninguna tasa ni cantidad. ~49 filas nombran variantes fuera del roster (33 Shiny, 8 formas, 8 especies) [`name-reconciliation.json`]. Critical Catch: mensajes del 2024-11-11 al 2026-09-17 (abarca cambios del juego), sin cadáveres vacíos ni kills (no da tasas), nombres en plural y con sufijo `[lucky bonus]` | Parcial: solo pertenencia al loot, tras deduplicar ítems y muestrear (H1B) y con respuesta sobre derechos (P3). Las filas fuera del roster esperan a P6. Tasas: `—` |
| Zonas de spawn | [S:Localizações]; [C:wiki-pka] 255 nombres de lugar en pt (se descartan las 51 filas de Outland) | 426 especies normales: Wildscape 98, Normal 240, Hoenn 143; 360 álbumes; **0 coordenadas** | 16 celdas «Hoenn» son la hunt «Tubos» 350+; texto libre en la columna Normal; los álbumes imgur son de terceros. Leer la columna «Normal» como «Kanto/Johto» es una interpretación: solo la apoyan las 6 Linked Tasks que la wiki sitúa «Em Johto ou Kanto» | Parcial: nivel de región o banda («Wildscape», «Hoenn 250+», «Tubos 350+») sin puntos. «Kanto/Johto» se publica solo si la correspondencia se confirma en todas las filas; si no, queda sin publicar. Las imágenes no se publican |
| NPC que pide el Pokémon | Oficial + [S:Tasks] | 171 especies con NPC; 118 NPC; 184/186 pares coinciden con la oficial | Owen (C-009); Dr. Oliveira y Scarlet (C-010) | Sí para los 184 pares corroborados; los 2 restantes, no |
| Medalla (buff/debuff) | [S:Medals] | 151 especies de Kanto | Sin rareza ni valores; la wiki no publica bonos por medalla; erratas de stats | Parcial: nombre del stat, sin valor; dato comunitario |
| Usos como material | [S:PokeTalents], [S:Boost], evolución oficial | 544 filas de talentos; 18 filas de boost | Totales de talentos en conflicto (C-005) | Parcial (ver Sistemas) |
| Equipos por rotación | [D] `teams.json`: 14 rotaciones completas, 132 entradas; Bug y Dragon incompletas; Normal no aparece. Otras fuentes, cada una de un solo autor: doc de loxas «sin T2-T3, nivel 350» y hunts por elemento de Safnaw (ambos en pkaguide), `community-teams` de Critical Catch | 14/18 elementos | U-003 (definición de rotación); el DOCX es para empezar Hoenn, no para 350+; cada documento es un único autor | Parcial: solo con permiso de cada autor (H5); sin permiso, nada |

### 2.2 Sistemas (35 páginas `sistemas/*` + guías oficiales)

| Página | Hechos | Mejor fuente | Cobertura / frescura | Conflictos y huecos | ¿Publicable? |
|---|---|---|---|---|---|
| Stars | Daño por estrella de T3 a Legendary; costos de 6 tiers × 3 formas de pago | Oficial; [S:Star Level] como apoyo | Coherente con [L:feed] del 2026-07-22 | Costo de SR (C-004); la hoja habla de la «opción 100 %» obsoleta (C-027) | Sí; el costo de SR usa el valor oficial y el conflicto queda interno |
| Boost | Tope +50; 1 punto = 3 niveles de daño; 10 piedras del 50 % al 5 %; +10 pp por fallo | Oficial | Completa (sin recetas a propósito) | Materiales por elemento solo en [S:Boost] (18); fragmentos por banda [S:Search Boost Items] son min/media/máx «en 477 días» | Sí las reglas; materiales como lista comunitaria; fragmentos como estimación |
| Talents | Bonos máximos; niveles 350/400/500 | Oficial | Sin materiales | [S:PokeTalents] (544 filas) no llega a los totales oficiales (C-005): probablemente le faltan los talentos de 350+ | Parcial: totales oficiales; materiales retenidos hasta conciliar |
| Medals | Cadena de Helena, tabla de XP de medalla hasta 110.600, 10 slots, 5 presets | Oficial | Faltan bonos por medalla | Stats por Pokémon solo en [S:Medals] | Sí las reglas; stats como dato comunitario |
| PokéLog y runas | 3 etapas por especie (4 ejemplos); costos de runa | Oficial; [S:Runes] | Casi todo son ejemplos | [S:Runes]: solo 0→1 completo; niveles 3–5 de Shiny Charm con `?` | Parcial (reglas); tabla de runas: No |
| Mega | Incompatibilidad con Stars; `!automega`; Sealed Mega Stones; variantes `mega` | Oficial, repartido en otros sistemas; [R] | Sin página propia; hechos dispersos en 13 páginas | Cómo se obtiene cada Mega Stone no consta; 5 Megas de Mega Dens fuera del roster | Parcial (reglas oficiales dispersas) |
| Helds | Fusión 25 % por tier; Relic Points; NPC de retiro (Rosemary) | Oficial | Faltan efectos por Held | Tipos con nombre (X-Lucky, Held Wing) solo en otras páginas; el resto de tipos solo en fuentes comunitarias [N:unit §3] | Sí (reglas); tipos: solo los que nombra la wiki |
| Addons, auras, costumes, Ditto Memory | Catálogos y reglas | Ninguna oficial: solo nombres sueltos; Ditto Memory solo en pkaguide y thiagobfo [N:unit §10] | ~0 % | Mapa aura→shader sin verificar | **No** hasta capturas de la ventana Customize (P4) |
| Training | 8 atributos, ganancia por nivel, reglas de carga | Oficial | Completa | — | Sí |
| Hazard | Efectos por nivel (tope 30); Sealed Mega Stones en 5/10 | Oficial | Tasas ocultas | — | Sí; tasas `—` |
| Experience | 7 bandas de corte de XP; pérdida desde nivel 50; Bless −70 %; Bless Plus −92 % | Oficial | Completa | Fórmula tipo Tibia: inferencia nuestra, no se publica como regla | Sí |
| Achievements | 109 (3 secretos); ~94 filas | Oficial | Completa | Hoenn 134 contra 135 del roster (C-020) | Sí |
| VIP | 10/18/25 D; límites; sistemas con VIP | Oficial | Completa | — | Sí |
| Outfits | 3 outfits | Oficial + [L:feed] | 7 marcadores sin rellenar | Faltan Lorekeeper, Superior Instinct y Founder Outfit (C-019) | Parcial (6 nombres, sin efectos) |
| Prey | 6 slots, 5 bonos, 1.000 puntos | Oficial | Completa | — | Sí |
| Catching (balls, brokes) | Multiplicador por ball; broke máximo por tier; distribución de balls | [C:CriticalCatch] stats-v2 (83.751 capturas, 408 Pokémon); [S:Brokes]; 19 tipos de ball por achievements [N:addons §0.2] | Oficial: nada, salvo la lista de balls | C-013 (UR 9.400 / 9.100), C-014 (multiplicador lineal o no lineal) | Parcial: lista de balls Sí; brokes como estimación con rango; multiplicadores: No |
| Shiny tiers | 15 UR, 16 Legendary, 3 Mythic; solo en Primal Areas | Oficial | 5 nombres sin fila en el roster | C-011 (Mewtwo Island) | Sí |
| Shiny rate | Kills por Shiny por tier | [S:Shiny Rate] | 7 columnas con cabecera numérica **sin etiqueta** | Significado desconocido | **No** |
| Monedas y tokens | Pokédólares (k/kk), Diamonds, Online Points 72/h, Twitch Points 10/5 min, 6 familias de tokens | Oficial | La página de tokens tiene 4 marcadores y se contradice | C-018 (Mewtwo Token); montos Rocket vacíos | Parcial |
| Market | Ofertas con VIP (100); precio medio; paginación | Oficial (ofertas con VIP) + [L:feed] 2026-07-11, 07-23, 08-03, 08-13, 08-19 | Sin página oficial | Comisión desconocida; no importar reglas de PokeXGames [N:items §3] | Parcial |
| Jully / TV Cam | 87 filas con precio | Oficial | Completa | — | Sí |
| Houses | Subasta de 3 o 6 días; 8 tiempos de proceso | Oficial | Sin zona horaria ni alquiler | — | Parcial |
| Global Buff, Calendar, GamePass | 3 buffs de 48 h; Premium 20 D; temporada 07-01→09-30, 50 niveles | Páginas oficiales | GamePass caduca el 2026-09-30; Calendar sin recompensas; Global Buff sin catálogo de tienda | — | Sí, con `effective_to`; GamePass solo con la temporada vigente al publicar |
| Fly/Surf/Ride, Teleport, Commands | Velocidades; 36 destinos; 24 comandos | Páginas oficiales + [L:feed] 2026-08-09 (teleport por minimapa) | Teleport incompleto | C-024 (frescura) | Sí |
| Guild | Costo (nivel 100, 5M), roles, bosses, límites | Oficial + [L:feed] 2026-08-09/10 | La sección de dailies está obsoleta | C-016 | Sí, con dailies según el feed. Bosses: [C:pkaguide] a partir de un vídeo, así que es un dato secundario; se retiene hasta confirmarlo |
| Analyzer, Hunt Stash, Task Tracker, Census, Duel, Expeditions | Descripción y reglas | Páginas oficiales | Hunt Stash sin lista de ítems; modificadores de Expeditions ocultos | — | Sí |
| World Transfer | — | Oficial | 13 marcadores | — | **No** |

### 2.3 Ítems

| Hecho | Mejor fuente | Cobertura | Conflictos y huecos | ¿Publicable? |
|---|---|---|---|---|
| Identidad con ID de servidor y sprite | Wiki: 228 IDs de evolución + 57 de tasks = 285 [N:items §1.1] | 285 ítems con ID | Nombres con prefijo de cantidad, entidades HTML y erratas («Blue Nido Ear Ear») | Sí (285) |
| Nombre canónico del resto | Por prioridad: tooltip del ítem capturado por el propietario (P4); export del Hunt Analyzer del propietario; texto de loot de [C:CriticalCatch], que sale en plural y con cantidad («seeds», «ghost essences»), así que pasarlo a singular es una inferencia y sirve de alias, no de nombre canónico; después [S:Drops] | 963 cadenas en la hoja (871 slugs wiki-pka y ~906 en thiagobfo, mismo linaje) | Coincidencia exacta (sin mayúsculas ni prefijo de cantidad) con los 285 nombres oficiales: 221 cadenas, que cubren 1.260 de los 3.650 pares. Quedan 742 sin coincidencia, entre ellas erratas de ítems oficiales. Deduplicación pendiente (cálculo propio sobre `sheet/drops.csv`, `official/item-id-map.tasks.json` y `official/evolution-extract.json`) | Parcial: tras deduplicar |
| Categoría | Las 14 categorías del Market fijadas por D-011 | 14 | — | Sí |
| Uso: evolución | Páginas de Pokémon | 652 menciones / 228 IDs | — | Sí |
| Uso: Boost / Talents / entregas de tasks | [S:Boost], [S:PokeTalents], oficial (35 ítems de entrega) | 18 / 544 / 35 | C-005, C-022 (heart/fairy stone, ghost/darkness stone) | Entregas: Sí. Boost y Talents: Parcial |
| Obtención: drops | Ver 2.1 | 3.650 pares | — | Parcial |
| Obtención: dens | [S:DgItems] | 55 dens | Falta Deino; `belt of champion(s)`, `fire wing(s)` | Parcial (lista comunitaria) |
| Obtención: recompensas de tasks y quests | Oficial: Linked Tasks, World Tasks y quests | 150 + 167 + 7 | — | Sí |
| Precio NPC (venta) | Ninguna fuente pública; tooltip «NPC Price» observado [N:unit] | ~0 % | Solo sueltos en el feed (Dragonair Tail $120→$245). El Hunt Analyzer muestra un «valor estimado» del loot, pero no dice si es el precio NPC | **No** hasta que haya capturas del tooltip |
| Sprite para tooltip [C0 A19] | `/api/assets/evolution-items/{id}.png` y `/api/assets/linked-task-items/{id}.png` de la wiki | 285 | El resto de ítems no tiene sprite público; el registro de sprites de [C0 A20] usa por ahora los sheets del propietario en `public/sprites/` como arte de relleno (D-011) | Enlazar los 285; el resto con arte de relleno hasta que el propietario vuelque los reales |
| Precio de tienda (compra) | Oficial (Jully / TV Cam) | 87 filas | — | Sí |
| Efectos | Oficial: otros ítems (4 de 10) y tokens | Mínima | foods está vacía; balls, cams, eggs y berries dan 404 | Parcial |
| Apilable, comerciable | DAT del cliente (flag de apilable, mapeo server−756 en 269/285) [N:items §1.6] | Inferido | Derechos de los assets (UK-006) | No publicar hasta decidir; uso interno |

### 2.4 Actividades

| Página | Hechos | Mejor fuente | Cobertura | Conflictos y huecos | ¿Publicable? |
|---|---|---|---|---|---|
| Linked Tasks | Orden, objetivo, cantidad (30→10.000), área, recompensas con ID de ítem | Oficial; la hoja coincide en 150/150 | Completa | Kills/h solo en [S:Linked Tasks!E] (107/150): estimación comunitaria; la hunt es un álbum imgur. Las 8 filas de [S:Linked Tasks!A170:E178] (Pokémon por tier y zona) tienen significado no declarado (UK-025) | Sí; kills/h como estimación; las 8 filas no se usan |
| World Tasks | 167 tasks / 167 NPC por región; 35 con varias etapas; recompensas (Shiny con ball, +5 Hazard) | Oficial | Sin ubicación de NPC | 116/118 NPC coinciden con [S:Tasks]; C-009, C-010 | Sí (sin mapa) |
| Hazard Tasks | 17 NPC, 58 requisitos | Oficial + [S:Hazard Tasks] (17/17 coinciden) | Completa | Erratas en la hoja | Sí |
| Mega Dens | 36 especies; Sealed Mega Stones | Oficial | Tasas ocultas | 5 Megas no están en el roster | Sí; esos 5 como `pending` |
| Gyms | 8 gyms: task, líder, medalla; reglas (10 min, sin revive, reintento 250k); cooldown de 1 s por medalla | Oficial; equipos de líder solo en [S:GYM!A11:H18] | Tasks 8/8 coinciden | C-006, C-007, C-028 | Sí las reglas y recompensas oficiales; equipos de líder como comunitarios (Parcial) |
| Rocket / Police semanal | 13 + 13 entrenadores; tiempos; tokens; 130 victorias | Oficial; equipos y counters en [S:Rocket], [S:Police] | Nombres de Police 13/13 | Falta Rocket Blaze en la hoja (C-008) | Sí; equipos Parcial; counters como recomendación comunitaria |
| Arcane Dens | Rareza→dificultad; niveles 50/100/200; recompensa diaria; 18 familias | Oficial; [S:DgMobs] (56), [S:DgItems] (55), [S:Dungeons] | Familias 18/18 coinciden, pero la página oficial dice «incluindo»: 18 es un mínimo, no el total | Hunt 1/2/3 = Easy/Medium/Hard es una **inferencia** (patrón de XP); 6 dens desactivadas; faltan Grimer y Chikorita en DgMobs; tiempos solo en 33 filas. La pestaña [S:DGs] es un borrador viejo y se descarta | Sí (reglas); mobs, tiempos e ítems como comunitarios; el índice no afirma «todas las dens» |
| Clones | 3 dificultades; 4 buffs a $400k; 20 tokens → Held T3–T7 al azar | Oficial | Completa | C-018 | Sí |
| Quests (7) | Nivel, pasos y recompensas | Oficial; muestra de Porygon en `content/quests.json` | Texto completo; la imagen del puzzle de Lucky Amulet da 404 | [S:Porygon] coincide en NPC y lugar | Sí |
| Expeditions | 4 slots; 3 h / 1 h 30 / 40 min | Oficial | Modificadores ocultos | — | Sí |
| Bounty contracts | 40 contratos por semana; buzón; reinicio dom→lun | [S:BH] | Nota única | — | **No** (retenida) |
| Eventos | Del feed | [L:feed] | Ventana de 20 entradas | — | Sí (H6) |
| Actividades nombradas solo por la comunidad (Brotherhood, Daily Shop) | Existencia | pkaguide [N:unit §3] | Nombre suelto | Sin fuente oficial | **No** hasta confirmarlo en la wiki oficial o en el juego |

### 2.5 Herramientas

| Herramienta | Datos | Estado |
|---|---|---|
| Stars | Tabla oficial de costos (6 tiers × 3 formas) y % de daño | Sí. Se cambia la fórmula de la hoja (`2^n` Pokémon) solo si la regla oficial de materiales la confirma: hoy es una hipótesis comunitaria |
| Experience | `/api/experience/{lvl}?progress=` + bandas y Bless | Sí. Se recomienda cálculo local con la tabla, no llamadas en vivo |
| Boost | Probabilidades oficiales; fragmentos por banda observados | Sí; los fragmentos se muestran como rango observado |
| Planificador de Linked Tasks | 150 tasks oficiales + kills/h estimado | Sí, sin progreso persistente; guardar en el navegador solo si el propietario lo aprueba (P15), porque [GKEP] reserva el progreso personal para Cuentas |
| Comparar Pokémon, Guild | Ya existen; Comparar se rehace por completo [C0 A13] | Necesita moveset y evolución de H1A |
| Estadísticas de captura | [C:CriticalCatch] | **No** sin permiso del autor (P11) |
| Hunt Finder (roadmap Fase 5) | Hunts con nombre y ubicación | **No**: no hay hunts con nombre ni coordenadas (UK-010, UK-017) |
| Constructor de rotaciones y equipos (roadmap Fase 5) | Definición de rotación + equipos | **No**: U-003 abierto y equipos sin permiso |
| Calculadora de Shiny (roadmap Fase 5) | Tasas o kills por Shiny | **No**: tasas ocultas y [S:Shiny Rate] sin significado (UK-013) |

### 2.6 Comunidad

| Página | Datos | Estado |
|---|---|---|
| Créditos | Autores: Mts Vitor (hoja); Shaolin Pig Slayer y Lucyaya (DOCX) [D:cabecera]; Roox (ruta de nivel en wiki-pka); Safnaw y loxas (guías de equipos en pkaguide); mantenedor de Critical Catch | Sí, una vez aceptado cada permiso y si el propietario acepta la página (P2). Si un autor exige crédito en cada página, lo decide el propietario |
| FAQ | 167 temas [S:FAQ] como índice; respuestas desde fuentes oficiales | Parcial: se reescribe; se excluyen cupones (R12), anuncios y enlaces de Discord caducados |
| Glosario | Jerga de [S:FAQ], [S:Linked Tasks], [D] | Sí |
| Guías de la comunidad | Ruta 1→150 [C:wiki-pka]; equipos [C:pkaguide] | No sin permiso |
| Comercio | Existente | Sin cambios de contenido en este plan (tiene su propio plan) |
| Aportar al mapa | Se retira [C0 A1] | Vuelve con el mapa interactivo |

### 2.7 Mundos

| Hecho | Mejor fuente | Cobertura | Huecos | ¿Publicable? |
|---|---|---|---|---|
| Servidores | [L:players]: Moon, Sun, Titan 1–3 | 5 | Población volátil (8.634 el 2026-09-19 01:28Z). `guilds.world_key` ya guarda mundos como texto libre | Sí la lista, como tabla en la portada [C0 A3]; población, pregunta P10 |
| Apertura de Titan | [L:feed] 2026-08-21 | — | — | Sí |
| Server Save | Regla candidata 00:00 America/Sao_Paulo | — | UK-009 | Sí, como ya se muestra |
| World Transfer | — | — | 13 marcadores | No |
| Regiones y bandas de nivel | Oficial: áreas de Linked Tasks (Hoenn, Wildscape, Johto/Kanto); roadmap y feed (Hoenn 250+); Primal Areas; Tubos [S:FAQ!R103] | 7 regiones o bandas | «Tubos» solo comunitario; Outland histórico (C-026) | Sí, salvo Tubos (Parcial) |
| Destinos de teleport | Oficial | 36 (Kanto 10, Johto 10, Hoenn 10, Orange 6) | Sin coordenadas | Sí |
| Hunts | Ninguna oficial. Pistas: 137 filas de hunts de Hoenn con álbum (thiagobfo `hoennHunts.json`, ya registradas en [CS]); ~360 álbumes en [S:Localizações]; hunts por elemento de Safnaw en pkaguide | 0 hunts con nombre verificado | Nombres de zona (UK-017) y coordenadas (UK-010) | **No** como entidades públicas; solo pertenencia a región o banda (§2.1) |
| Marcadores de mapa | 119 flags del cliente (`content/map/markers.json`); 112 marcadores de [C:Gmatheusux] como pista | 119 | Semántica de muchos flags sin resolver | Ya se publica en `/mapa`; los de Gmatheusux quedan como pista interna |
| Ubicación de NPC | Ninguna estructurada | 0/167 | UK-010 | No (solo nombre y región si la página oficial lo dice) |

### 2.8 Destacados y Cambios

| Hecho | Fuente | Cobertura | ¿Publicable? |
|---|---|---|---|
| Entradas de cambios | [L:feed]: 20 entradas, 269 viñetas normalizadas. | 2026-07-11→08-20 | Sí, resumidas en es/en (no se copia el cuerpo); se agregan por `id` de noticia |
| Planificado frente a entregado | Roadmap oficial 2026 (unos 10 elementos; 2 ya entregados según el feed) | — | Sí, con el estado corregido por el feed (C-017) |

---

## 3. Cambios al modelo de entidades

### 3.1 Principios
- **`content/` es la verdad** [D-011], [D-012]. El sitio público se construye desde esos JSON (`src/lib/content/repository.ts`); Supabase es el modelo de servicio futuro y se llena desde `content/` más adelante. El camino crítico del contenido son los **contratos JSON** (§3.3), no la migración.
- Las relaciones que se consultan en ambos sentidos («¿quién lo dropea?» y «¿dónde se usa?») van en tablas tipadas. Lo irregular va a `metadata` [DM §2.2].
- Las tablas del modelo son pocas y genéricas: un mismo patrón «costo por nivel» sirve para Stars, Runes, Talents, Boost, medallas y GamePass.
- Lo desconocido es `null`; ningún default convierte un desconocido en 0.
- **Migraciones:**
  - La 8.ª (`20260915192641_knowledge_expansion_relations.sql`) y la 9.ª (`20260918220000_remove_provenance.sql`, que elimina la procedencia) no están aplicadas en remoto ni probadas con SQL integrado.
  - Recomiendo una **10.ª migración** separada para lo de §3.4. Depende de tablas de la 8.ª (`activities`, `activity_rewards`), así que no se aplica en ningún entorno antes de que la 8.ª y la 9.ª pasen su prueba SQL.
  - Aplicarlas «en local» exige la pila local de Supabase (Docker); si no está disponible, no se afirma que estén aplicadas.
  - Todo arranca con deny-by-default y RLS, como la 8.ª.

### 3.2 Dominio → estado actual → cambio

| Dominio | Hoy (tablas y enums) | Cambio propuesto | Fuentes que lo llenan |
|---|---|---|---|
| Pokémon | `pokemon_species`, `pokemon_variants` (`normal`/`shiny`/`mega`/`other`), elementos, moves | Sin cambios de tabla. Las formas que faltan (Castform Fire/Ice/Electric/Snow, Smeargle Shiny, Megas) se añaden como `other`/`mega` en estado `pending`. Se añade `variant_kind` `form` solo si el roster lo requiere | [R], [I-S §5] |
| Evolución | `evolution_edges.requirements` (JSONB) | Nueva tabla `evolution_requirements(from_entity_id, to_entity_id, relationship_key, ordinal, item_entity_id, quantity, level_min, conditions)` para el uso inverso del ítem | 652 menciones, 228 IDs |
| Ítems | `items(item_kind, metadata)` | Añadir `server_item_id integer unique`, `category_key` → nueva `item_categories`, `stackable boolean null`, `tradeability` (`tradeable`, `unique`, `unknown`). El `clientId` lo escribe el propietario en el registro del ítem (D-011); el mapeo server − 756 no se usa como dato | [N:items], [S:Drops], [C:CriticalCatch] |
| Monedas | — | Pokédólares, Diamonds, Online Points, Twitch Points, GamePass Points y los tokens como `item` con `item_kind='currency'` o `'token'`, para que los costos referencien entidades | Oficial |
| Drops | `drop_relations` con `rate_kind` y conteos (8.ª) | Sin cambio. Lista comunitaria → `rate_kind='unknown'`. El `listed` de [GKEP] equivale a «fila existente con `rate_kind='unknown'`»: se documenta esa equivalencia en [GKEP] en vez de añadir un valor. Las dens pueden ser fuente (`source_entity_id` = actividad de den) | [S:Drops], [S:DgItems] |
| Spawns | `spawn_relations` (8.ª) | Vocabulario de `spawn_kind`: `region_listed` (columna de la hoja), `hunt`, `primal`, `event`. La hoja entra a nivel de región o banda; los álbumes imgur no se guardan | [S:Localizações] |
| Ubicaciones y hunts | `locations(location_kind, parent, region_key)`; `hunts` + `hunt_pokemon` (0003); `spawn_relations.hunt_entity_id` (8.ª) | Documentar el vocabulario de `location_kind`: `region`, `level_band` (Wildscape, Hoenn 250+, Tubos 350+, Primal Area), `city`, `island`, `building`, `dungeon`, `gym`, `teleport_destination`. Las hunts usan la tabla `hunts` que ya existe, no un `location_kind` nuevo. El nivel de acceso va en `progression_milestones` | Oficial |
| NPC | `npcs(location, metadata)` | Nueva `npc_roles(npc_entity_id, role_kind, related_entity_id)`, con `role_kind` en `task_giver`, `vendor`, `buyer`, `trainer`, `quest_giver`, `service` | Oficial; [N:items §2] |
| Actividades y tasks | `activities`, `activity_rewards` (8.ª) | Añadir `activities.series_key`, `ordinal`, `difficulty`, `repeatability` (`one_time`, `daily`, `weekly`, `repeatable`, `seasonal`, `unknown`), `level_min` y `time_limit_seconds`. Nueva `activity_requirements(activity, stage, ordinal, requirement_kind [defeat, deliver_item, deliver_pokemon, capture, level, prior_activity], subject_entity_id, variant_constraint, quantity, conditions)`. Nueva `activity_participants(activity, entity, role [host_npc, opponent, mob, boss, leader], ordinal, quantity, conditions)`. En `activity_rewards`: añadir `stage` y `reward_context` (`first_completion`, `repeat`, `per_stage`, `daily`, `boss`) | Linked 150, World 167, Hazard 17, Gyms 8, Rocket/Police 26, Dens 18×3, Clones 3 |
| Quests | `quests`, `quest_steps`, `quest_rewards` | Añadir `quest_requirements` (mismo esquema que `activity_requirements`), o reutilizar esa tabla haciendo que la quest también sea actividad. Recomiendo la tabla nueva para no mezclar semánticas | Oficial |
| Sistemas con niveles | `system` + `metadata` | Nuevo tipo de entidad `upgrade_node` y tablas `upgrade_nodes(node, system, node_kind [star_step, rune, talent, medal, training_attribute, boost_band, gamepass_level], group_key, slot, max_level)`, `upgrade_costs(node, level_from, level_to, payment_option, cost_entity_id, quantity, success_rate, conditions)` y `modifiers(owner_entity_id, stat_key → stat_keys, operation, value, unit, level, conditions)` | Stars, Runes, Talents (544 filas), Medals (151), Boost, Training, GamePass |
| Parámetros por tier | — | Vocabulario `tiers(tier_key, canonical_name, ordinal)` con T1–T7, Super Rare, Ultra Rare, Legendary, Mythic y Ultimate, más `tier_parameters(system_entity_id, tier_key, parameter_key, dimensions jsonb [role, band, step], value numeric null, value_text, unit, approximate boolean)`. `~900` → `approximate=true`; `?` → `null` | Stars (% daño), Brokes, Shiny Rate, Damage |
| Equipos y rotaciones | `content/rotations.json` (muestra) | Nuevas `team_builds(build_id, element_key, audience, author_credit, status)` y `team_build_members(build_id, ordinal, group_no, variant_entity_id, stars, role, tier_note, cooldown_note, needs_testing)`. Pros, contras y mejoras van como `content_revisions` (prosa editorial) | [D] (14 rotaciones, 132 entradas) |
| Mundos | `world_key` como texto libre en `map_features` y en `guilds` (esta última ya aplicada en remoto) | Nueva `game_worlds(world_key, canonical_name, opened_at, status)`. Opcional: `world_population_snapshots(world_key, captured_at, players)`. `map_features.world_key` y `guilds.world_key` pasan a FK solo después de comprobar que los valores guardados coinciden con las claves nuevas | [L:players], [L:feed] |
| Cambios | `change_events`, `change_event_entities` (8.ª) | Sin cambio; importador idempotente por `id` del feed | [L:feed] |
| Economía | `economy_entries` (8.ª) | Sin cambio. Jully → `purchase`; precio NPC → `sale` cuando haya captura | Oficial |
| Alias | `entity_aliases(alias, locale, alias_kind)` | Check de `alias_kind`: `official_display`, `game_text`, `spelling`, `typo`, `pt_term`, `es_term`, `abbreviation` (sh, DD, KK, DG), `legacy`. Las erratas son buscables pero nunca se muestran | [I-S §5] |
| Stats | — | `stat_keys(stat_key, canonical_name)` normalizado desde [S:Medals], [S:PokeTalents] y [S:Runes]; las erratas (`Critital Damage`, `Fly Spped`) van como alias | [S] |

### 3.3 Contratos JSON (antes de cargar datos)
1. Un JSON Schema por archivo de `content/`, referenciado con `$schema` para que VS Code autocomplete [D-011].
2. Esquema de relaciones (drops, spawns, requisitos, participantes, costos, recompensas) con sujeto, objeto y cantidades `null` por defecto. Sin estado, `basis` ni ids de evidencia.
3. Fechas en ISO 8601.
4. `pnpm content:check` valida esquemas, ids únicos, alias sin colisiones y referencias entre archivos.

### 3.4 Esquema de la 10.ª migración (resumen; el SQL definitivo se escribe en su hito)
1. **Tipos:** `alter type entity_type add value 'upgrade_node'` y `'world'` (solo si los mundos se enlazan desde contenido; si no, basta `game_worlds`).
2. **Columnas:** las de `items`, `activities` y `activity_rewards` indicadas en §3.2, con checks de vocabulario y sin defaults que conviertan desconocido en 0. Los números quedan `null` por defecto.
3. **Tablas nuevas:**
   - `item_categories`, `evolution_requirements`, `npc_roles`, `activity_requirements`, `activity_participants`, `quest_requirements`
   - `upgrade_nodes`, `upgrade_costs`, `modifiers`, `stat_keys`, `tiers`, `tier_parameters`
   - `team_builds`, `team_build_members`, `game_worlds`
4. **Vista `item_usage_v`:** unión de `evolution_requirements`, `upgrade_costs`, `activity_requirements` y `quest_requirements` sobre `item_entity_id`. Es la fuente del bloque «Se usa en».
5. **Vista `item_sources_v`:** unión de `drop_relations`, `activity_rewards`, `quest_rewards` y `economy_entries(kind=purchase)`. Es la fuente del bloque «Cómo se obtiene».
6. **Índices:** en cada FK de entidad y en `(series_key, ordinal)`.
7. **Seguridad:** RLS activado y `revoke` a `anon`/`authenticated`, igual que la 8.ª. Las páginas públicas consumen la salida curada del build.

### 3.5 Carga de datos

No hay staging ni capa normalizada [D-012]. Cada dominio tiene su archivo en `content/`:

| Dominio | Archivo | Cómo se llena |
|---|---|---|
| Pokémon | `content/pokemon.json` | `pnpm content:roster`; ediciones a mano |
| Moves, evolución y habilidades (H1A) | Archivos nuevos en `content/` o campos nuevos del Pokémon | A mano o con un importador pequeño desde las páginas `pokemon-v4` |
| Ítems | `content/items/categorias.json` y `content/items/<categoría>.json` [D-011] | A mano, con registros de relleno `"borrador": true` |
| Outfits y addons | `content/outfits.json` [D-011] | A mano |
| Auras | `content/auras.json` [D-011] | A mano |
| Sprites | `public/sprites/sprites.json` y `public/sprites/<carpeta>/` [D-011] | A mano |
| Mapa | `content/map/markers.json`, `content/map/floors.json` | `scripts/map/extract-otmm-preview.mjs` para los pisos |
| Quests, ubicaciones, rotaciones | `content/quests.json`, `content/locations.json`, `content/rotations.json` | A mano |
| Sistemas, actividades, NPC, mundos, cambios | Archivos nuevos en `content/` que define cada hito | A mano o con un importador pequeño |

La hoja comunitaria, el DOCX y los datos de Critical Catch siguen fuera de Git (`research-inbox/community-files/`, ignorado) hasta tener permiso de sus autores (P3, P12); el propietario los usa como referencia para decidir valores. El build público sólo lee `content/`, así que CI y producción generan el mismo sitio. Las tablas de §3.4 siguen siendo el destino cuando Supabase se llene desde `content/`.

### 3.6 Identidad, slugs y alias
- `entities.canonical_slug` es **único globalmente** [supabase/migrations/202609090003]. Hay colisiones reales: el NPC o servicio «Kecleon Shop», añadido al Trade Center el 2026-07-20 según [L:feed] y [N:items §2], contra el Pokémon `kecleon` [R]; medallas con nombre de especie; quests con nombre de Pokémon (Porygon).
- **Regla:** los Pokémon conservan el slug limpio. Las demás entidades en colisión llevan un calificador de tipo (`kecleon-shop`, `medal-bulbasaur`, `quest-dr-vektor`). La URL sigue anidada por sección.
- **Estabilidad:** el slug se fija al crear la entidad y no cambia si después se corrige el nombre (p. ej. «Blue Nido Ear Ear» de la wiki). La corrección añade el nombre viejo como alias `legacy` [AG «Stable entity IDs/slugs do not depend on display names»].
- **Nombre canónico:** el texto del juego (§5). Las variantes de ortografía de la hoja se guardan como alias con su `alias_kind`. La conciliación de `name-reconciliation.json` (4.364 menciones; 3.931 exactas; 246 por «sh»; 12 por mayúsculas; ~25 erratas; 15 formas; 9 especies ausentes) se carga como alias; lo que no se concilia queda `null`, nunca como corrección silenciosa.

---

## 4. Orden de ingesta por hitos

### 4.1 Cómo se publica un valor

Sin claims, estados ni etiquetas internas [D-012]: un valor está en `content/` o no está.

| Situación | Qué se guarda en `content/` | Qué ve el jugador |
|---|---|---|
| Valor de la wiki oficial o del juego | El valor | El valor |
| Valor sólo de la hoja comunitaria | El valor, si el propietario lo acepta; si no, `null` | El valor o `—` |
| Estimación comunitaria con unidad conocida (kills/h, fragmentos por banda, brokes) | Rango mínimo–máximo, si el propietario lo acepta | «≈ mín–máx», nunca como cifra exacta |
| Estimación sin unidad o significado (Shiny Rate, Damage, Runes 2–5) | `null` | `—` o bloque omitido |
| Recomendación (equipos, counters, tier de uso) | Contenido editorial, no un campo de datos | Texto editorial, con crédito si el autor lo pide (P2) |
| Valores contradictorios (Anexo A) | El que elija el propietario; mientras tanto `null` | El valor o `—` |
| Página oficial contradicha por el feed posterior | El valor del feed | El valor; aviso breve sólo si cambia una decisión |
| Inferencia de Alliance Codex (Hunt 1/2/3 = Easy/Medium/Hard; ID de cliente −756) | Nada hasta confirmarla | Se omite |
| Registro de relleno | El registro con `"borrador": true` | Visible por defecto; un flag de build puede ocultarlo |

La hoja comunitaria y sus copias (thiagobfo, pkaguide, wiki-pka, Nrzty, pmassambani) son una sola referencia: que un valor aparezca en varias copias no lo confirma. Critical Catch sólo sirve para ver que un drop existe; no da tasas, y sus registros anteriores a un cambio del feed no cuentan.

### 4.2 Hitos

**Relación con las etapas de [GKEP]:** H0 y H1A cierran la Etapa B; H1B y H4 son la Etapa C; H6 es la Etapa D; H3 cubre la E y la parte de actividades de la F; H2 es la F; H5, H7 y H8 son la G. El orden recomendado (abajo) ejecuta F, E y D antes que C, al revés que [GKEP] y que la «siguiente acción» de [CS]. Ese cambio necesita una decisión nueva en `docs/DECISION_LOG.md` antes de empezar H2 (P17).

**Relación con el Corte 0 visual:** H0, H1A y H1B solo tocan datos y pueden correr en paralelo al Corte 0 visual. Todo hito que construye o cambia páginas públicas (H2 en adelante) espera a que aterrice la v2 del Corte 0 con sus maquetas [C0 §1.5], [D-010].

Cada hito cierra con los mismos requisitos generales:
- `pnpm run ci` y `pnpm content:check` en verde.
- `docs/CURRENT_STATUS.md` y `knowledge/unknowns/UNKNOWNS.md` actualizados.
- Términos nuevos o alias de jerga pasan por `knowledge/localization/GLOSSARY.md`.
- Contenido es/en en `human_reviewed` (quién revisa: P20).
- Barrido anti-relleno de las páginas tocadas [D-010].
- Aceptación visual del propietario, separada de los checks automáticos.

#### H0 — Registros y contratos (sin cambios públicos)
- **Alcance:**
  - Registros de D-011 con valores de relleno: `content/items/categorias.json` (14 categorías del Market en el orden del juego), un archivo por categoría, `content/outfits.json`, `content/auras.json` y `public/sprites/sprites.json`.
  - JSON Schemas y `pnpm content:check` (§3.3).
  - La hoja comunitaria y sus exportaciones fuera de Git (§3.5).
  - Redactar la 10.ª migración (§3.4). Sólo se aplica, en local, después de que la 8.ª y la 9.ª pasen su prueba SQL; en remoto, nunca dentro de este plan sin autorización.
  - Decisión en `docs/DECISION_LOG.md` si el propietario aprueba el cambio de orden de etapas (P17).
- **Salida:**
  - `pnpm content:check` en verde.
  - Alias cargados sin colisiones de slug: el validador falla ante un alias compartido entre entidades del mismo tipo.
  - `git check-ignore` confirma que la hoja comunitaria no entra en Git.

#### H1A — Pokédex con datos oficiales (cierra la Etapa B)
- **Alcance:** moves, evolución con requisitos, habilidades de campo, descripción y velocidades de Fly/Surf/Ride a partir de las 914 páginas en caché y de la guía oficial de velocidades. Los 285 ítems con ID oficial se crean aquí porque la evolución los necesita.
- **Gate de la Etapa B [GKEP]:** denominador documentado, IDs estables, variantes verificadas y búsqueda bilingüe sin colisiones. [GKEP] y [CS] piden además intentar conciliar C-001 (530/526/507). Si sigue sin resolverse al cerrar H1A, se publica «910 variantes» y el número de especies queda sin publicar (P5); no se fuerza.
- **Salida:**
  - Todas las filas de move de las 803 páginas normalizadas y con slot ordenado.
  - Los 652 requisitos de evolución resueltos a un ítem, o `null`.
  - Las 85 páginas con valores por defecto marcadas como desconocidas; una prueba verifica que ninguna ficha muestra 90/1575/60. Experience = 1575 en las 263 filas sospechosas queda sin publicar (UK-023).
  - Moves, evolución y descripción cargados en `content/` para las páginas con datos.
- **Publicable al cerrar:** sí (datos; las páginas nuevas esperan al Corte 0 visual).

#### H1B — Ítems canónicos + relaciones comunitarias de la Pokédex
- **Alcance:**
  - Deduplicar las 963 cadenas de drop contra los 285 ítems oficiales y el texto de loot de Critical Catch.
  - Crear relaciones de drop con `rate_kind='unknown'` para los 3.644 pares distintos (3.650 con los 6 duplicados).
  - Crear `spawn_relations` por región o banda (426 especies).
  - Crear la relación NPC ↔ Pokémon (184 pares corroborados).
  - Guardar el elemento del moveset y el stat de medalla si el propietario los acepta (§4.1).
- **Salida:**
  - Cada cadena queda mapeada a un ítem o en una lista de revisión, sin fusiones automáticas por similitud por debajo del umbral.
  - Drops de la hoja cargados sólo con visto bueno del propietario (§4.1).
  - Relaciones inversas consistentes: el ítem X lista la variante V si y solo si V lista X.
  - Ninguna imagen imgur en la salida pública.
  - Si P3 no se resuelve, nada de esto entra en `content/` (§3.5).
- **Publicable al cerrar:** pertenencia de drops y regiones, **siempre que P3 lo permita**. Si no, solo la parte oficial.

#### H2 — Sistemas desde la wiki oficial
- **Alcance:**
  - Las páginas de §2.2 marcadas Sí o Parcial, incluida `mega`.
  - Tablas tipadas: costos de Stars, bandas de Boost, tabla de XP de medallas, bandas de XP, GamePass, Jully.
  - Volver a descargar las páginas con fecha de caducidad (GamePass, Calendar) justo antes de publicar.
  - Guild corregido con el feed.
  - Complementos comunitarios según la matriz de §4.1.
- **Salida:**
  - Cada página de sistema tiene reglas, números y límites en `content/`.
  - Ningún marcador «a preencher» llega a la salida.
  - C-004, C-016 y C-018 decididos por el propietario o dejados en `null`.
  - Contenido `effective_to` (GamePass) con caducidad probada.
- **Publicable:** sí. Retenidas: World Transfer, Shiny Rate y la tabla de runas.

#### H3 — Actividades
- **Alcance:**
  - Linked Tasks (150), World Tasks (167), Hazard Tasks (17), Mega Dens (36), Gyms (8), Rocket y Police (26).
  - Arcane Dens: las 18 familias conocidas × dificultad (lista no exhaustiva según la wiki), más 6 desactivadas como `deprecated`.
  - Clones, las 7 quests y Expeditions.
- **Salida:**
  - 100 % de requisitos y recompensas resueltos a entidades; las recompensas en texto libre se permiten solo con `reward_key`.
  - Etapas y repetibilidad explícitas [GKEP «Etapa E»].
  - La inferencia de dificultad de las dens queda sin publicar hasta confirmarse.
  - Counters y equipos como contenido editorial (§4.1).
  - El planificador de Linked Tasks puede leer la serie ordenada.
- **Publicable:** sí.

#### H4 — Fichas e índice de Ítems
- **Alcance:**
  - Fichas de ítem generadas desde `item_sources_v` y `item_usage_v`.
  - Categorías.
  - Monedas y tokens.
  - Precios de Jully.
  - Balls: los 19 tipos, con sprite oficial en 12.
- **Salida:**
  - Cada ítem publicado tiene al menos una fuente de obtención o un uso.
  - Precios NPC de venta en `null` (se muestra `—`) hasta que el propietario los escriba en `precioNpc` [D-011].
  - Filtros «quién lo dropea» y «dónde se usa» probados en móvil.
  - Cada ítem mencionado en cualquier página publicada tiene registro y tooltip [C0 A19].
- **Publicable:** sí para los ítems con datos.

#### H5 — Rotaciones y tiers
- **Alcance:**
  - `/pokedex/tiers` con el tier oficial, el elemento del moveset (comunitario) y los tiers Shiny, o su integración en el Comparar rehecho (P19).
  - `/rotaciones/{element}` con las 14 rotaciones del DOCX.
  - Bug y Dragon se muestran incompletas o se omiten; Normal no tiene rotación en el DOCX.
  - Las otras guías de equipos (loxas, Safnaw, Critical Catch) solo con permiso de cada autor.
- **Salida:**
  - Nombres del DOCX conciliados con el roster; las formas ausentes quedan como `pending`.
  - Pros, contras y mejoras redactados en es/en con palabras propias.
  - Crédito aceptado por los autores (P3).
  - Las 6 discrepancias de tier se muestran con el valor oficial.
- **Publicable:** solo con permiso de los autores del DOCX. Sin él, se publican solo los tiers oficiales.

#### H6 — Mundos y Cambios
- **Alcance:**
  - `game_worlds` (5 mundos).
  - Regiones y bandas.
  - 36 destinos de teleport.
  - Fichas de NPC (nombre, rol, tasks, región si consta). Los nombres de NPC nunca se traducen [C0 Q3].
  - Importador del feed que añade entradas por `id`, con el contrato de [CI]. La ejecución diaria con una GitHub Action queda como tarea futura en `docs/ROADMAP.md` (P21); mientras tanto, entrada manual.
  - Roadmap conciliado.
- **Salida:**
  - Ninguna entrada del feed se pierde entre snapshots.
  - Cada entrada enlaza a ≥1 entidad cuando corresponde.
  - La población, si se aprueba, lleva la hora de captura y nunca es el único contenido del bloque.
- **Publicable:** sí.

#### H7 — Herramientas
- **Alcance:** Stars, Experience, Boost y el planificador de Linked Tasks (persistencia según P15).
- **Salida:**
  - Pruebas de dominio con casos límite: 0→5 en cada tier; nivel 1, 50 y 550; Boost +50.
  - Los resultados coinciden con las tablas oficiales en las filas de ejemplo.
  - Sin llamadas en vivo a la wiki en tiempo de uso.
- **Publicable:** sí.

#### H8 — Comunidad
- **Alcance:** Créditos, FAQ reescrita, Glosario y guías de terceros con permiso.
- **Salida:**
  - Cada respuesta de FAQ enlaza a una ficha o sistema.
  - Sin cupones ni enlaces caducados.
  - Créditos con el texto que cada autor aprobó.
- **Publicable:** sí (FAQ y Glosario); el resto, con permiso.

#### H9 — Observación dirigida y mapa (continuo)
- **Alcance:**
  - Capturas del propietario para decidir valores contradictorios (C-004…C-011, C-013).
  - Tooltips de ítem (nombre, NPC Price).
  - Exports del Hunt Analyzer. La wiki documenta ítems, cantidades y valores del loot, y criaturas con número de abates, en JSON o CSV; **no** documenta IDs de ítem. El loot es de toda la sesión, así que una tasa por criatura solo sale de sesiones con una sola especie. Qué contiene de verdad el export se comprueba con el primero (UK-026).
  - Etiquetas de la UI del cliente en es, en y pt.
  - Alineación de zonas con OTMM según `docs/POKEDEX_LOCATION_CAPTURE_PROTOCOL.md`. El mapa queda fuera del foco actual [C0 A11]: prioridad baja.
- **Salida por captura:**
  - El valor pasa a `content/`.
  - Una zona pasa a geometría solo tras revisión [DM §6].

**Orden recomendado:** H0 → H1A → H2 → H3 → H6 → H1B → H4 → H7 → H5 → H8, con H9 en paralelo.
- Primero va lo oficial, completo y sin riesgo de derechos.
- Los hitos que dependen de la hoja (H1B, H4 en parte y H5) esperan a la respuesta de los autores (P3).
- H1B conserva la numeración del encargo («Pokédex primero»), aunque se ejecute después.
- Este orden se aparta de [GKEP] (Etapa C antes que D, E y F). Si el propietario no aprueba ese cambio (P17), el orden pasa a H0 → H1A → H1B (solo la parte oficial de ítems) → H4 → H6 → H3 → H2 → H7 → H5 → H8.

---

## 5. Plan de idioma

**Las lenguas fuente son pt-BR**: la hoja, el FAQ, el DOCX, la wiki oficial y el feed. Las lenguas editoriales son **es** (primaria; `/` redirige a `/es/`) y **en**.

| Contenido | Lengua fuente | Tratamiento |
|---|---|---|
| Pokémon y variantes | EN (roster) | Canónico, no se traduce. «Shiny» y «Mega» no se traducen [glosario]. Las erratas de la hoja van como alias `typo` |
| Ítems | EN (wiki con ID; texto de loot; hoja) | Se guarda el texto del juego tal cual (`canonical_name`). Las fuentes no coinciden en mayúsculas: la wiki mezcla «Reaper Cloth» y «phantom tail», la hoja y el loot usan minúsculas y plural. Orden: tooltip capturado → nombre de la wiki con ID → resto como alias. La capitalización de visualización es una regla documentada en `knowledge/localization/GLOSSARY.md`, no un nombre nuevo. Ejemplo: «Necesitas 50 Oran Berry» [AG] |
| Moves y habilidades | EN (página) | Canónicos. «Montaria» es alias pt de Ride si se confirma en el juego |
| Sistemas | Títulos pt en la wiki; etiquetas del juego en EN o localizadas | El canónico es la etiqueta del juego capturada: Boost, Stars, Helds, Hazard, Linked Tasks, Prey, GamePass, Global Buff. Los títulos pt («Tasks do Mundo», «Polices Semanais», «Treinamento») son alias `pt_term`. El título editorial es/en es propio. El cliente del propietario muestra la UI en español («Entrenamiento», «Mantén Shift para fijar») con filas en inglés [N:unit]: las etiquetas es del cliente se capturan como `localizedNames` (H9). La Pokédex del cliente en español muestra «NIVEL 40» para el nivel requerido [C0 Q5] |
| NPC, quests (nombres propios) | pt/EN | Tal cual: Dr. Oliveira, Captain Willy, Jully; los NPC siempre conservan su nombre [C0 Q3]. Si la quest solo tiene título pt en la wiki, se guarda ese título y un título editorial es/en |
| Lugares | EN (Viridian, Cerulean, Olivine) | Canónico EN. Las indicaciones pt («Norte de Olivine», «Ilha sul de Fuchsia») se reescriben como descripción es/en |
| Stats (medallas, talentos, runas) | EN derivado del juego, con erratas | `stat_keys` en EN normalizado; etiqueta es solo si el cliente la muestra |
| Prosa (FAQ, DOCX, guías y sistemas oficiales, feed) | pt-BR | Redacción original en es y luego en en, sin traducción literal ni frases copiadas (§6). `content_revisions` con `translation_status`: `proposed` → `human_reviewed` |
| Jerga comunitaria | pt-BR | Glosario (DD = Diamonds, KK = millones de Pokédólares, sh = Shiny, DG = dungeon, hunt, broke, Tubos, rotação) y alias `pt_term`/`abbreviation` para la búsqueda |
| Números | pt-BR («67,5 kk», «1.000.000») | Se analiza según la configuración regional de la fuente. Se guardan unidades base enteras. Se muestran con `es-MX` y `en-US` [C0 A8, T11], no según el navegador. Dinero (Pokédólares en k/kk, Diamonds): entero exacto agrupado, sin decimales ni «≈» (`CORTE_0_CODEX_TOOLTIP_SPEC.md` §4.6 «KK exactos»); «≈» queda para estimaciones que no son dinero (kills/h, brokes, fragmentos). kk y D son unidades del glosario |
| Búsqueda | — | Índice con nombre canónico + alias en pt, es y en + palabras clave del FAQ (`pegaheld`, `tubos`). Los alias nunca sustituyen el nombre mostrado [glosario] |

**Flujo de trabajo:**
1. Se redacta en es.
2. Se produce la versión en en.
3. Revisión humana de ambas.
4. Si una lengua falta, se muestra la existente con aviso [DS]; nunca se genera una traducción silenciosa.
5. `pt` queda como `locale_code` para alias, no como lengua de producto [DM §4].

---

## 6. Derechos y contacto

| Material | ¿Se reproduce? | Cómo |
|---|---|---|
| Hechos (nombres, cantidades, relaciones, números de la wiki, la hoja o el feed) | Sí, como hechos | Estructura y presentación propias. No se replica la maqueta de la hoja ni se ofrece la hoja completa como descarga. Las leyes de algunas jurisdicciones (incluida Brasil, Lei 9.610/98 art. 7 XIII) protegen la selección y organización de bases de datos: una copia masiva y literal de la hoja es el riesgo, no el uso de hechos sueltos. No es asesoría legal |
| Prosa de la wiki oficial (guías, sistemas, quests) | No literal | Reescritura propia. La regla 6 de Discord (`knowledge/rules/discord-rules.md`; ver C-003) permite usar la información del cliente y la wiki para wikis comunitarias; no cubre copiar texto ni assets (UK-006). Los términos del sitio cambiaron el 2026-09-17 (`v1789689677`): revisar si tocan reutilización de contenido antes de publicar |
| Cuerpo del feed del launcher | No literal | Resumen propio por entrada, con fecha |
| Respuestas del FAQ, notas del DOCX, recorridos (Porygon, BH) | No | Solo estructura y hechos, con crédito |
| Álbumes imgur (mapas de hunts) | **No** | No se guardan, ni se rehospedan ni se enlazan como contenido. Las zonas propias salen de OTMM y de capturas |
| Sprites de Pokémon e ítems de la wiki | Enlazados, no copiados (práctica actual) | Mantener así hasta aclarar UK-006. El registro local de sprites y sheets [C0 A20] usa los sheets que volcó el propietario, ahora en `public/sprites/`, como arte de relleno (D-011); los PNG instalados del cliente llevan PKA1, y los frames de outfits descifrados son una vista previa local (D-008). Su publicación en producción sigue sujeta a UK-006 (P16) |
| Datos crudos de Critical Catch | **No** (contienen nombres de jugadores) | Solo agregados desidentificados y con permiso |
| Transcripciones de YouTube, texto de Gmatheusux copiado de la wiki | No | Excluidos (ya fuera del caché) |
| Repos de cliente descifrado, bots y macros | No se usan | Excluidos [I-C §1] |

**Recomendación: contactar antes de los hitos H1B, H4 y H5.** A cada autor se le pide permiso para republicar hechos, una línea de crédito, licencia o condiciones, un canal para correcciones y, en el caso de la hoja, acceso de lectura a la hoja superior `1ID3qu…`.

| A quién | Por qué | Canal probable |
|---|---|---|
| **Mts Vitor** | Autor de la hoja; los derivados lo acreditan (Nrzty) o le quitaron el crédito (thiagobfo `0135ccd`) | Discord de la comunidad o del juego |
| **Shaolin Pig Slayer y Lucyaya** (Moon) | DOCX de equipos [D], enlazado en [S:FAQ!R72] | Discord o juego |
| **Mantenedor de Critical Catch** | Loot y capturas medidos | Sitio o Discord |
| **Hiaan (pkaguide), Safnaw, loxas** | Guías de equipos y hunts | GitHub o Discord |
| **Roox** | Ruta de nivel en wiki-pka | Discord |
| **Administradores de PokeAlliance** | Export estructurado, catálogo de ítems con IDs, permiso de sprites, corrección de páginas obsoletas | Discord oficial |

Mientras no haya respuesta, solo se publica lo oficial y lo verificado por el propietario. La hoja se usa internamente para priorizar y contrastar.

---

## 7. Riesgos y preguntas para el propietario

### 7.1 Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Falsa confirmación: siete sitios comunitarios copian la misma hoja | Un valor repetido parece confirmado | Contar la hoja y sus copias como una sola referencia; el propietario decide (§4.1) |
| Snapshot de la hoja sin acceso a la hoja superior | Datos que envejecen sin aviso | pkaguide actualiza a diario: vigilar sus commits como señal de cambio (Ciclo 6 [GKEP]) |
| Páginas oficiales obsoletas frente al feed (guild, roadmap, tokens, outfits, teleport) | Reglas viejas en páginas nuevas | Comparar cada sistema con el feed antes de publicarlo; aviso breve si cambió |
| Errores al deduplicar ítems | Relaciones de drop o uso equivocadas | Emparejamiento con umbral + revisión manual; nada de fusiones automáticas |
| Valores por defecto de la plantilla (85 páginas) y Experience = 1575 en 263 filas | HP/XP/nivel falsos | Tratar 90/1575/60 como desconocido (con prueba); retener Experience = 1575 hasta corroborarlo (UK-023) |
| Entidades ausentes del roster (Garbodor, formas, Megas, Shiny Tangrowth) | Enlaces rotos desde tasks y dens | Entidades `pending` no indexadas; decisión P6 |
| Colisión global de slugs (Kecleon) | Error de importación o URL equivocada | Regla de calificador de tipo (§3.6) + validador |
| Build público que depende de archivos ignorados | CI y producción generan sitios distintos; datos sin permiso filtrados al repo público | Solo lo publicable entra en `content/` (§3.5) |
| Cambio de orden de etapas sin decisión registrada | El plan contradice [GKEP] y [CS] y la próxima sesión sigue el documento viejo | Decisión nueva antes de H2 (P17) |
| Copias de la hoja comunitaria en Git | Datos sin permiso publicados en GitHub | La hoja y sus exportaciones quedan en `research-inbox/community-files/` (ignorado), comprobado con `git check-ignore` |
| Mostrar estimaciones como hechos (kills/h, brokes, fragmentos) | Decisiones erróneas del jugador | Sólo rangos aceptados por el propietario, con «≈»; sin ordenar por falsa precisión |
| Contenido con fecha de caducidad (GamePass hasta el 2026-09-30) | Destacados caducados; la temporada capturada habrá terminado antes de publicar | `effective_to` obligatorio en Destacados, con prueba; nueva captura en H2 |
| Derechos de la hoja o el DOCX sin respuesta | Retirada de contenido o conflicto con la comunidad | Contacto previo; la hoja fuera de Git; crédito |
| Volumen editorial (unas 60 páginas de sistemas y actividades × 2 idiomas) | Traducción apresurada o prosa de relleno | Redacción por plantilla de tipo de página; revisión humana; barrido anti-relleno |
| Privacidad (Critical Catch, ranking de guild) | Nombres de jugadores publicados | Solo agregados; el ranking de guild sigue siendo privado con RLS |
| Contrato visual en transición (RubinOT → Codex Tooltip, [D-010]) | Rehacer páginas dos veces | Esta arquitectura no depende del estilo; las páginas nuevas se construyen sobre la v2 del Corte 0 visual, con maquetas aprobadas [C0 §1.5] |

### 7.2 Preguntas abiertas

- **P1. Taxonomía.** ¿Se aprueban las 8 secciones con estas decisiones?
  - Mundos incluye servidores, regiones, lugares, NPC y mapa.
  - Guías y Cambios cuelgan de Destacados.
  - Rotaciones se agrupa bajo Pokédex.
  - `/items`, `/actividades`, `/mundos` y `/comunidad` como rutas nuevas (`mapa/aportar` ya se retira por A1).
- **P2. Publicación de datos comunitarios.** ¿Se acepta que los valores de la hoja se publiquen sólo cuando el propietario los acepte (§4.1), sin marcas por dato, y con una página de Créditos para los autores que den permiso?
- **P3. Contacto.** ¿Quién contacta a los autores y por qué canal? Sin respuesta, ¿publicamos solo lo oficial o también la pertenencia de drops y zonas como hechos sueltos?
- **P4. Capturas propias.** ¿Puede el propietario hacer sesiones de captura?
  - Tooltips de ítem y NPC Price.
  - Exports del Hunt Analyzer tras hunts de una sola especie, con kills (dan nombres de ítem y tasas observadas; si incluyen IDs está por comprobar, UK-026).
  - Etiquetas de la UI del cliente en es, en y pt.
  - Ventana Customize.
  - Decidir C-004 (costo de SR), C-005 (talentos), C-006/C-007 (gyms), C-009 (Owen), C-011 (Shiny legendarios) y C-013 (brokes).
- **P5. Denominador de especies.** ¿Se publica «910 variantes» y se deja sin cifra el número de especies mientras siga C-001?
- **P6. Entidades ausentes del roster.** ¿Se crean como `pending` las que la wiki no lista pero sí aparecen en tasks, dens o documentos (Garbodor, Megas de Mega Dens, formas de Castform y Smeargle Shiny)?
- **P7. Idioma de las rutas en `/en/`.** ¿Se mantienen segmentos en español (`/en/sistemas/`) o se localizan con redirecciones?
- **P8. Lengua primaria.** ¿Se confirma es como primaria, en con revisión, y pt solo como alias por ahora?
- **P9. Tablas sin significado claro.** ¿Retener Shiny Rate, Damage y Runes hasta saber qué significan sus columnas, o preguntar a Mts Vitor?
- **P10. Población por mundo.** La tabla de mundos ya está pedida [C0 A3]. ¿Lleva población? Si sí, ¿como instantánea del build con la hora de captura o en vivo?
- **P11. Critical Catch.** ¿Usar sus agregados, si hay permiso, para estadísticas de captura y corroborar drops?
- **P12. Hoja comunitaria fuera de Git.** ¿Se confirma que la hoja y sus exportaciones quedan fuera del repositorio público hasta tener permiso?
- **P13. Historial de cambios.** ¿Tiene el propietario snapshots viejos del feed (caché del launcher) o capturas del changelog de Discord para ampliar Cambios antes del 2026-07-11?
- **P14. Pedido a los administradores.** ¿Pedimos a los administradores de PokeAlliance un export de ítems con IDs y la corrección de páginas obsoletas (guild, roadmap, tokens, outfits)?
- **P15. Progreso del planificador de Linked Tasks.** [GKEP] reserva el progreso personal para Cuentas. ¿Planificador sin progreso guardado, o se aprueba guardarlo en el navegador (como ya hace Guild) como excepción registrada?
- **P16. Sprites.** Resuelta en parte por A20/D-011: los sheets de `public/sprites/` sirven de arte de relleno hasta que el propietario vuelque los reales. Queda abierto con qué derechos se publican en producción (UK-006).
- **P17. Orden de etapas.** ¿Se aprueba ejecutar Sistemas, Actividades y Mundos antes que Ítems y loot (al revés que [GKEP] y la «siguiente acción» de `CURRENT_STATUS.md`), y registrarlo como decisión nueva?
- **P18. Páginas con muestras.** Hasta que lleguen H2, H3 y H5, ¿Guías, Sistemas y Rotaciones siguen públicas con las muestras actuales o se ocultan (`noindex`, fuera del menú)?
- **P19. Una sola superficie de tiers.** ¿`/pokedex/tiers/` sustituye al explorador de tiers de `/herramientas/pokemon`, o los tiers viven dentro del Comparar rehecho (A13)?
- **P20. Revisión humana es/en.** ¿Quién revisa unas 60 páginas en dos idiomas antes de pasar a `human_reviewed`? Sin revisor, ningún hito cierra.
- **P21. Ingesta automática del feed.** ¿Se autoriza un trabajo programado (Vercel Cron o GitHub Actions) que lea `/launcher/feed` y `/launcher/players` a diario, o seguimos con snapshots manuales?

---

## Anexo A. Valores contradictorios (para decisión del propietario)
El propietario decide qué valor se escribe en `content/`; mientras tanto el campo queda `null`. «Criterio provisional» es la recomendación de este plan.

| ID | Tema | Valor A | Valor B | Criterio provisional |
|---|---|---|---|---|
| C-001 | Número de especies | 530 en la portada de la wiki | 526 filas normales y 507 números de Pokédex distintos en [R] | Publicar «910 variantes»; especies sin cifra (P5) |
| C-003 | Alcance de la regla 6 | La regla 6 de Discord permite usar cliente y wiki para herramientas comunitarias | La sección 6 de los términos del sitio trata de la cuenta | Documentos distintos; ninguno da derecho a redistribuir assets (UK-006) |
| C-004 | Costo de Stars SR 0→5 | 240 D + 60 kk [S:Star Level!R6] | 260 D + 70 kk; rompe el patrón 4:1 de la propia fila | Se publica B; verificar en el juego |
| C-005 | Totales de talentos | Ofensivo 19 % (Electric/Fairy 18 %; defensa 16 %), HP +1.400, #10 = crit chance [S:PokeTalents] | +29 %, HP +3.200, #10 = crit damage | Se publica B; materiales retenidos |
| C-006 | Nivel de Gym | «lvl 250+» [S:GYM!E1] | Dungeon 200, batallas 250 | B |
| C-007 | Recompensas de Gym | 4 Potent Boost Stones [S:GYM!E1] | 1M XP + 5 Bubble Gum por task, 3M XP la dungeon, medalla y orbs [W] | B; A es posible recompensa adicional sin confirmar |
| C-008 | Entrenadores Rocket | 12 + Giovanni [S:Rocket] | 13, incluido Rocket Blaze | B |
| C-009 | Task de Owen | Sandslash, Dugtrio [S:Tasks] | Diglett, Sandshrew y sus shinies | B |
| C-010 | Dr. Oliveira y Scarlet como NPC de task | Sí [S:Tasks] | No son NPC de task; Dr. Oliveira es NPC de quest | B |
| C-011 | Spawn de Shiny legendarios | Solo Mewtwo Island, 350+ [S:FAQ!R31] | Solo Primal Areas | B; Mewtwo Island puede ser una Primal Area |
| C-012 | Tier de 6 variantes | Machamp T2, Shiny Victreebel T2, Togetic T3, Shiny Togetic T2, Shiny Qwilfish T2, Nuzleaf T2 [S:Tier List] | T3, T3, T4, T3, T3, T4 [R]. El DOCX nombra 5 de las 6 (no Nuzleaf) y coincide con el roster en 4; en Togetic coincide con la hoja (T3) [`name-reconciliation.json` `teamsDocTierChecks`] | Roster |
| C-013 | Broke máximo | UR 9.400; SR 3.500 [S:Brokes], pmassambani | UR 9.100 (thiagobfo, Critical Catch); SR 3.512 (thiagobfo) | Retener o mostrar como rango estimado |
| C-014 | Multiplicador de ball | Lineal 4x/5x (thiagobfo FAQ, pmassambani) | No lineal (Critical Catch vía Gmatheusux) | No publicar |
| C-015 | Daño por estrella | 2–15 % según tier [S:Star] | +4 % plano (Critical Catch vía Gmatheusux) | A (oficial + hoja) |
| C-016 | Dailies de guild | 3 objetivos fijos, Guild Tokens | Por elemento desde 08-09; niveles Comum/Wildscape/Primal con Medal Tokens desde 08-10 [L:feed] | B; el nombre del token (Guild Token o Medal Token) queda abierto hasta verlo en el juego |
| C-017 | Hoenn 250+ | Planificado en el roadmap 2026 | Abierto 2026-08-19 [L:feed] | B |
| C-018 | Uso del Mewtwo Token | Costo de evolución | 20 tokens → Held aleatorio | B |
| C-019 | Lista de outfits | 3 outfits | + Lorekeeper, Superior Instinct, Founder Outfit [L:feed] | Unión |
| C-020 | Especies de Hoenn | 134 | 135 filas normales gen-3 [R] | Sin resolver (ligado a C-001) |
| C-021 | Tier de legendarios | «1» en la página | ULTIMATE en el roster (27 filas) | Roster |
| C-022 | Piedras de elemento en Boost y dens | heart stone (Boost Fairy); ghost stone (Boost Ghost) [S:Boost] | fairy stone; darkness stone (den de Gastly) [S:DgItems]; la wiki lista Heart, Fairy, Darkness y Ghost como piedras distintas | Verificar en el juego |
| C-023 | Overrides de tier de pkaguide | Mega Scolipede Legendary, Mega Dragalge Mythic (origen no declarado) | T2 [S:Tier List] | Ninguno: formas fuera del roster |
| C-024 | Teleport | Comando de chat | + teleport por minimapa (2026-08-09) [L:feed] | Unión |
| C-026 | Spawns de Outland | 51 filas [C:wiki-pka] | Sin rastro en la wiki actual (`/api/search?q=Outland`) | `deprecated` |
| C-027 | Éxito de Stars | «Opción 100 %» [S:Star!A4] | Siempre tiene éxito | B |
| C-028 | Tamaño de la task de Alfred | Redacción que se contradice a sí misma | — | Verificar |

C-025 se reserva: el denominador de especies ya es C-001.

## Anexo B. Desconocidos
Se suman a `knowledge/unknowns/UNKNOWNS.md` al trabajar cada hito; los valores quedan `null`.

| ID | Necesidad | Cómo resolverlo |
|---|---|---|
| UK-011 | Nombre canónico de hasta 742 cadenas de loot sin coincidencia exacta con un ítem oficial (el número baja al deduplicar) | Capturas del Hunt Analyzer, loot de Critical Catch |
| UK-012 | Tasas de drop | Rates ocultas por diseño; quedan `null` |
| UK-013 | Significado de las 7 columnas de [S:Shiny Rate] | Preguntar al autor |
| UK-014 | Unidad y ventana de tiempo de [S:Damage] | Preguntar al autor |
| UK-015 | Runas de nivel 2 a 5 | Captura en el juego |
| UK-016 | Correspondencia de Hunt 1/2/3 con Easy/Medium/Hard en dens | Inferencia; confirmar |
| UK-017 | Nombres de las ~360 zonas de hunt (álbumes) | Alineación con OTMM y capturas |
| UK-018 | Precios NPC de venta | Tooltips |
| UK-019 | World Transfer | Página vacía |
| UK-020 | Mecánica de los Bounty Contracts | Solo nota comunitaria |
| UK-021 | Si las medallas son ítems y cuánto valen sus bonos | Wiki sin valores |
| UK-022 | Método de medición de kills/h | Preguntar al autor |
| UK-023 | Si Experience = 1575 (263 filas del roster) es un valor real o un valor por defecto | Captura en el juego o corrección de la wiki |
| UK-024 | Qué es una «rotación» y qué la define (se enlaza con U-003 de `docs/RISKS_AND_UNKNOWNS.md`); si la columna «Normal» de [S:Localizações] equivale a «Johto ou Kanto» | Wiki oficial o juego; contraste de todas las filas |
| UK-025 | Significado de las 8 filas de [S:Linked Tasks!A170:E178] | Preguntar al autor |
| UK-026 | Campos reales del export del Hunt Analyzer (¿IDs de ítem? ¿loot por criatura?) y base de su «valor estimado» | Primer export del propietario |

## Anexo C. Archivos de trabajo (fuera del repo)
Base: `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/content/`

- `sheet/`: 27 exportaciones CSV + JSON, con `_manifest.json` y `_tab-inventory.json`.
- `teams.json`, `name-reconciliation.json`, `wiki-cross/`.
- `official/`: 49 páginas, 914 páginas Pokémon, `official-wiki-inventory.json`, `conflicts-and-quality.json`, `item-id-map.tasks.json`, `evolution-extract.json` y `launcher/`.
- `community/`: `MANIFEST.json` y los datos fijados por commit.
- `CONTENT_PLAN.md`: este documento.
