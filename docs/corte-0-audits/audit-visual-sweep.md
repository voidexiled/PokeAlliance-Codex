# Corte 0: what players see on every page, content and visual audit (2026-09-18)

## Summary

I captured 72 full-page screenshots: 18 routes, in es and en, at 1440 and 390 wide. I also captured 54 interactive states and 56 closer crops, and read every text dump. Nothing in the repo was changed. My dev server on port 4400 is stopped. Astro wrote its own `.astro/dev.log`, which git ignores.

The shell is visually fine, but many pages have almost no real content for a player. Four sections (Guías, Sistemas, Rotaciones, Cambios) show a single sample record or are empty. The biggest problems are:
- **The global search does not filter.** On `/es/buscar/?q=charizard` it shows all 915 records and the box is empty.
- **Raw developer text is on screen:** `AVAILABILITY_SCOPE`, `amount: 12 · unit: second`, `flagId`, `OTMM`, `Supabase`, `Temporal`, `America/Sao_Paulo`.
- **Kickers, intros and status badges** sit on almost every page, plus a dead "Datos de la ficha" section on all 910 Pokédex pages.
- **English text on /es pages, and Portuguese/Spanish on /en.**
- **Tiny text:** 193 `font-size` declarations are below 12px.
- **Selection colours differ everywhere:** gold, red, type colour or neutral, depending on the page.

How the capture was done:
- **Screenshot folder (SHOTS):** `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/corte0/shots/`
  - `{es|en}-{route}-{desktop|mobile}.png`, with a `.txt` (innerText) and a `.json` (metrics) next to each;
  - `states/` for interactive states;
  - `seg/` for 1:1 crops of one viewport each.
- **Scripts** in `…/scratchpad/corte0/`: `capture.cjs`, `states.cjs`, `segments.cjs`, `cssfind.cjs`, `probe.cjs`.
- **Horizontal overflow:** no page scrolls sideways at 390 (scrollWidth equals clientWidth on every route). Clipping happens inside components instead (map controls, guild table).
- **Capture artifact:** full-page Pokédex shots show blank cards below the fold. That comes from `content-visibility:auto` (`wiki-reference.css:2122`) and is not a bug players see. The `seg/` crops show the cards rendered.

Abbreviations used below:
- `P/` = `src/pages/[locale]/`
- `C/` = `src/components/`
- `S/` = `src/styles/`
- "es/en L" = line numbers of the Spanish and English copy objects.

---

## 1. Inventory

**Routes.** Every route exists in `es` and `en`, and all are prerendered.

| Route | Source | Purpose |
|---|---|---|
| `/` | `src/pages/index.astro` | Redirects to `/es/` (no language detection). |
| `/{l}/` | `P/index.astro` | Home: search, roster of 3 starters, 4 section cards, Server Save card. |
| `/{l}/pokedex/` | `P/pokedex/index.astro` + `C/wiki/PokedexGrid.tsx` | Filterable grid of 910 Pokémon. |
| `/{l}/pokedex/[slug]/` | `P/pokedex/[slug].astro` + `C/wiki/OutfitPreview.tsx` | Species/variant page, 910×2 (checked charizard and shiny-ditto). |
| `/{l}/guias/` | `P/guias/index.astro` | 1 quest and 1 location, from `*.sample.json` datasets marked `research_sample_not_application_ready`. |
| `/{l}/sistemas/` | `P/sistemas/index.astro` | 1 item and 1 move, sample data. |
| `/{l}/rotaciones/` | `P/rotaciones/index.astro` | 1 research "assertion", sample data. |
| `/{l}/herramientas/` | `P/herramientas/index.astro` | Tools hub with status badges and a roadmap. |
| `/{l}/herramientas/pokemon/` | `P/herramientas/pokemon.astro` + `C/tools/PokemonExplorer.tsx` | Compare two variants, plus an "Explorar tiers" list. |
| `/{l}/herramientas/guild/` | `P/herramientas/guild.astro` + `C/tools/GuildRankingTool.tsx`, `C/tools/guild/GuildWorkspaceChrome.tsx`, `C/tools/GuildPersistencePanel.tsx` | Guild ranking from the JSON the client exports. |
| `/{l}/mapa/` | `P/mapa/index.astro` + `C/map/MapExplorer.tsx` | Minimap flags drawn over a thumbnail of each floor. |
| `/{l}/mapa/aportar/` | `P/mapa/aportar.astro` | Describes a contribution format; there is no way to submit. |
| `/{l}/comercio/` | `P/comercio/index.astro` + `C/trade/TradeDesk.tsx` | Composer for a local, copy-only listing. |
| `/{l}/cambios/` | `P/cambios/index.astro` | Empty changelog. |
| `/{l}/buscar/` | `P/buscar/index.astro` + `C/wiki/ContentSearch.tsx` | Search over 915 records. |
| 404 | — | **Missing.** Players get Astro's default "404: Not found" page (English, Astro logo, shows "Path:"). |

**Shell and shared components:**
- `src/layouts/AppLayout.astro`: top bar, sidebar, mobile `<details>` nav.
- `C/wiki/AllianceWordmark.astro`, `C/wiki/WikiSearch.tsx` (home search), `C/phase3/ServerSaveStatus.tsx` (home card).
- `C/ui/*`: badge, button, dialog, dropdown-menu, input, kbd, sheet, tabs, textarea are used. card and separator are imported only by dead components.
- Styles: `S/global.css` (3364 lines), `S/wiki-reference.css` (5496), `S/home.css`, `S/guides.css`, `S/trade.css`.

**Dead code (never rendered).** Delete these files in Corte 0:
- `C/phase3/ReadinessPanel.tsx` ("Núcleo operativo", "Modelo con provenance")
- `C/phase3/RoutePlaceholder.astro` ("Estado de esta sección")
- `C/wiki/DataStatus.astro`
- `C/wiki/EvidenceTrail.astro` ("De dónde sale este dato")
- `C/wiki/RecordCard.astro`
- `C/wiki/WikiPortalPanel.tsx`
- `C/wiki/WikiSourceCard.tsx`
- Their CSS: `.wiki-source-card*` (`S/wiki-reference.css:1012-1100`), `.wiki-featured-arrow` (`:795`), `.wiki-footer` (`:430`).

---

## 2. Content slop

Category codes:
- **KICK**: decorative kicker or eyebrow
- **INTRO**: restates the title
- **META**: process or status text about the project or data
- **DEV**: developer-facing text
- **DISC**: disclaimer
- **DUP**: duplicated label
- **FILL**: filler or empty state
- **BADGE**: badge that adds nothing
- **I18N**: wrong language
- **SEO**: title or meta description
- **ARIA**: wrong or English-only accessible text
- **PH**: placeholder

A separate issue covers every page: the page-header eyebrows are hidden by CSS (`S/wiki-reference.css:512-514 .wiki-page-header > .eyebrow {display:none}`) but still exist in the source. Delete them in the source, then delete that rule.

### Shell (AppLayout, config)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `src/layouts/AppLayout.astro:38` | both | Default description "Wiki comunitaria de PokeAlliance." (Spanish, also used on en) | I18N/SEO | REPLACE with a per-locale default. es «Wiki de PokeAlliance: Pokédex, mapa, guías y herramientas.» / en «PokeAlliance wiki: Pokédex, map, guides and tools.» |
| `AppLayout.astro:99` + `P/index.astro:34/54` | both | Tab title «Inicio · Alliance Codex» | SEO | REPLACE on home: es «Alliance Codex · Wiki de PokeAlliance» / en «Alliance Codex · PokeAlliance wiki». |
| `AppLayout.astro:123-125` | both | Placeholder «Busca Pokémon, items o quests» | DUP/inconsistent | REPLACE with one site-wide string: es «Buscar Pokémon, items o quests» / en «Search Pokémon, items or quests». Search boxes today mix items/objetos and quests/misiones (`P/index.astro:38`, `C/wiki/ContentSearch.tsx:25`, `C/wiki/PokedexGrid.tsx:39`, `lib/content/repository.ts:94-95`). The owner needs to pick one term per concept. |
| `AppLayout.astro:134` | both | aria «Cambiar a English» / «Switch to Español» | ARIA (mixed languages) | REPLACE es «Ver en inglés» / en «View in Spanish». |
| `AppLayout.astro:143,151` | both | Titles «Navegación lateral», «Tema oscuro» on fake icons | FAKE | DELETE (see §3). |
| `AppLayout.astro:53` vs `:181` | both | Group heading «Herramientas» directly above the link «Herramientas» | DUP | DELETE the hub link (and the hub page, see §8). |
| `AppLayout.astro:67` | both | Nav item «Buscar» | DUP (search box is in the top bar on every page) | DELETE from nav. |
| `AppLayout.astro:71` | both | Nav item «Cambios», which leads to an empty page | FILL | DELETE until there are entries. |
| `AppLayout.astro:73-77` | both | Nav item «Aportar al mapa», a dead-end page | META | DELETE until a real submission channel exists. |
| `AppLayout.astro:226-227` | both | «Servidor / Server Save · 00:00 BR» at 10px, 3.3:1 contrast | KEEP the fact, rewrite it | REPLACE es «Server Save · 00:00 (hora de Brasil)» / en «Server Save · 00:00 (Brazil time)», at 12px in the muted token. Label «Servidor/Server» is redundant: DELETE. |
| `AppLayout.astro:232` | both | Visible summary «Navegación principal» / «Main navigation» | ARIA copy shown on screen | REPLACE es «Menú» / en «Menu». |
| `src/i18n/config.ts:27-29,47-49,66-68` | both | Unused keys `language`, `status` «Estado del proyecto», `publicFoundation` «Fundación pública» | META (dead) | DELETE. |
| `src/i18n/config.ts:40/59` vs `P/rotaciones:17/27` | both | Nav «Rotaciones» vs title «Rotaciones y tiers» | DUP/inconsistent | REPLACE the nav label with es «Rotaciones y tiers» / en «Rotations & tiers» (or rename the page to match the nav). |

### Home (`P/index.astro`; es L34-51 / en L54-71)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:36/:56`, rendered `:96` | both | Kicker «ALLIANCE CODEX» | KICK (the top bar already shows the brand) | DELETE |
| `:37/:57` | both | «Encuentra lo que necesitas para jugar.» | tagline | REPLACE with a functional heading: es «Busca en la wiki de PokeAlliance» / en «Search the PokeAlliance wiki». Update `tests/e2e/smoke.spec.ts:16,161`. |
| `:38/:58` | both | «Buscar Pokémon, items, misiones o sistemas» | DUP/inconsistent | REPLACE with the unified string from the shell table. |
| `:39/:59`, `:106-109` | both | CTA «Explorar Pokédex» | DUP (Pokédex is linked 4 times on this page) | DELETE |
| `:40-41/:60-61`, `:112-132` | both | «POKÉDEX DE POKEALLIANCE», «Ver todos los Pokémon ↗», 3 hard-coded starters | decorative | DELETE the whole roster panel. |
| `:42/:62` | both | h2 «Explorar la wiki» | generic | REPLACE es «Secciones» / en «Sections». |
| `:44,46,48,50 / :64,66,68,70` | both | Section-card details | KEEP (short, helps the player choose) |
| `:142` | both | `aria-label={route.title}` hides the detail text | ARIA | DELETE the aria-label. |
| `:51/:71`, `:157-159` | both | Server Save card | DUP of the sidebar note; the date is frozen at build time (§3) | DELETE, or rebuild as a client island (next table). |

### ServerSaveStatus (`C/phase3/ServerSaveStatus.tsx`)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:23/:28` | both | «Hora canónica convertida a tu zona» | DEV | REPLACE es «Próximo Server Save en tu hora» / en «Next Server Save in your time». |
| `:37` | both | Badge «Temporal» (the name of the JS API) | DEV/BADGE | DELETE |
| `:24/:29`, `:46` | both | «Tu fecha local: America/Mexico_City» (the label says date, the value is a zone ID) | DEV | REPLACE es «Tu zona: Ciudad de México» / en «Your time zone: Mexico City», using `Intl` display names. |
| `:49` | both | «00:00 · America/Sao_Paulo» | DEV | REPLACE es «00:00, hora de Brasil» / en «00:00 Brazil time». |

### WikiSearch
| `C/wiki/WikiSearch.tsx:44` | both | `<Kbd>Ctrl K</Kbd>` with no key handler | FAKE | DELETE (or implement it, §3). |
|---|---|---|---|---|

### Pokédex index (`P/pokedex/index.astro`; es L18-23 / en L26-31) and `C/wiki/PokedexGrid.tsx` (es L38-56 / en L57-75)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `index:20/28` | both | «ARCHIVO DE CAMPO» / «FIELD ARCHIVE» | KICK | DELETE |
| `index:21/29` | both | «Encuentra una especie, reconoce su variante y abre su ficha.» | INTRO | DELETE |
| `index:22-23/30-31`, `:77-81` | both | «REGISTRO POKEALLIANCE 910 ENTRADAS» | DUP of «910 Pokémon encontrados» | DELETE |
| `index:69-71,83` | both | Fake device lights and Poké Ball watermark | decorative | DELETE |
| `Grid:41/60` | both | legend «Todas las variantes» on the variant switch | ARIA | REPLACE es «Variante» / en «Variant» |
| `Grid:40/59`, `:219` | both | aria-label «Filtros de la Pokédex» on a `div` with no role (ignored) | ARIA | REPLACE with `role="group"`, es «Filtros» / en «Filters» |
| `Grid:44-45/63-64` | both | Screen-reader labels equal the default option text | ARIA | REPLACE es «Generación», «Tipo» / en «Generation», «Type» |
| `Grid:46/65`, `:259` | both | Sort select labelled «Número Pokédex» | ARIA (wrong) | REPLACE es «Ordenar por» / en «Sort by» |
| `Grid:54-55/73-74` | both | Unused keys `generation`, `level:'Tier'` | dead | DELETE |
| `Grid:53/72`, `:295` | both | aria «Abrir ficha de X» overrides the tier and types in the card | ARIA | DELETE the aria-label (the name comes from the h2) |
| `Grid:319` | both | title «Outfit #7» | DEV/I18N | DELETE |
| `Grid:323,332` + the name itself | both | Variant signalled 3 times: «Shiny X», ✦ and «SHINY»; plus «NORMAL» on normal cards | DUP | KEEP ✦ (with screen-reader text es «Shiny» / en «Shiny»); DELETE the `:332` label |
| `Grid:331` | both | «—» when the role is null | FILL | DELETE when null |
| `Grid:279-283` and `:350-352` | both | «Limpiar filtros» twice when there are no results | DUP | KEEP only the one inside the empty state |
| `Grid:348` | both | «?» glyph | decorative | DELETE |

### Pokédex detail (`P/pokedex/[slug].astro`; es L67-81 / en L84-98) and `C/wiki/OutfitPreview.tsx`
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:108` | both | Description «Charizard · Alliance Codex» (same as the title) | SEO | REPLACE es «{name} en PokeAlliance: tier {T}, rol {rol}, tipos {tipos}, nivel {n}.» / en «{name} in PokeAlliance: tier {T}, role {role}, types {types}, level {n}.» |
| `:136` | both | alt «Charizard, sprite de PokeAlliance» (Spanish, also on en) | I18N | REPLACE alt with «{name}» |
| `:70/:87`, `:145` | both | Eyebrow «POKÉDEX» above the name | KICK (duplicates the breadcrumb) | DELETE |
| `:187-207` (+ `:24-36`, `:71-73/:88-90`) | both | «NORMAL / Datos de la ficha / 6 campos» with no content, on **all 910** records | FILL/META | DELETE the section. Update `smoke.spec.ts:33`. |
| `:74/:91`, `:209` | both | Previous/next nav with aria «Resumen» / «Summary» | ARIA | REPLACE es «Pokémon anterior y siguiente» / en «Previous and next Pokémon» |
| `Outfit:156/166`, `:217` | both | «OUTFIT DEL JUEGO · #7» | META (internal ID) | REPLACE with es «Outfit» / en «Outfit» and no ID. Update `smoke.spec.ts:79`. |
| `Outfit:161/171` | both | «Premier · prueba» / «Premier · preview» | META (the shader match is unverified, per the comment at `:18-19`) | DELETE the option until verified |
| `Outfit:159/169`, `:258-275` | both | «Sin aura» shown as an Ultra Ball icon | misleading | REPLACE with a text chip: es «Sin aura» / en «No aura» |
| `Outfit:225` | es | alt «Charizard · south» (English key) | I18N | REPLACE es «{name}, vista {sur}» / en «{name}, facing {south}» |

### Guías (`P/guias/index.astro`; es L24-31 / en L35-42)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:25/:36` | both | «Misiones, recompensas y rutas disponibles en el archivo.» | INTRO/META | DELETE |
| `:77`, `:135` | both | Counts «1» in mono | BADGE | DELETE |
| `:85` | both | «QUEST» hard-coded in English | KICK/I18N | DELETE |
| `:87` (data) | es | «Help Dr. Vektor remove a virus…» | I18N (editorial text in English) | REPLACE es «Ayuda al Dr. Vektor a eliminar un virus del Digital World y desbloquea el acceso permanente al área de Porygon.» Localize `data/normalized/quests.sample.json`. |
| `:106-111` (data) | es | «Accept the mission» … «Return to Dr. Vektor» | I18N | REPLACE es «Acepta la misión», «Usa la computadora junto al Dr. Vektor», «Resuelve la secuencia de colores de la computadora», «Activa la sala final», «Derrota a Giant Porygon», «Vuelve con el Dr. Vektor» |
| `:117-121` (data) | es | «5,000,000 experience», «Permanent access to the Porygon-area computer» | I18N | REPLACE es «5,000,000 de experiencia», «Acceso permanente a la computadora del área de Porygon». Keep canonical item names («50 Empty Alliance Ball», etc.). |
| `:119` | both | ✦ bullets | decorative | DELETE |
| `:146` | both | «CITY · KANTO» (raw `kind`) | DEV/I18N | REPLACE es «Ciudad · Kanto» / en «City · Kanto» using an enum-to-label map |
| `:30/:41`, `:149` | both | «Ruta de viaje» used as the heading over access requirements | mislabel | REPLACE es «Cómo llegar» / en «How to get there» |
| `:151-156` (data) | es | «Visit the city», «Speak with the Pokémon Center Nurse or Nurse Joy» | I18N | REPLACE es «Visita la ciudad», «Habla con la enfermera del Pokémon Center (Nurse Joy)» |
| `:160` | both | «mode: Teleport · command: h "saffron» (raw object, closing quote missing) | DEV | REPLACE with «Teleport: `h "saffron"`» in both locales |

### Sistemas (`P/sistemas/index.astro`; es L18-27 / en L30-39)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:21/:33` | both | «Consulta de forma directa qué hace cada objeto y cómo funciona cada movimiento.» | INTRO | DELETE |
| `:22/:34` | both | «Objetos de sistema» / «System items» | vague | REPLACE es «Items» / en «Items» (depends on the vocabulary decision) |
| `:73,:93` | both | Counts «1» | BADGE | DELETE |
| `:80` | both | «TRAINING_CHARGER» | DEV | REPLACE with a label: es «Cargador de entrenamiento» / en «Training charger» (or DELETE) |
| `:83` (data) | es | «Adds 20,000 standard-progress charges to the Punching Bag» | I18N | REPLACE es «Añade 20,000 cargas de progreso estándar al Punching Bag.» |
| `:100` | both | Kicker «PVE» | KICK | REPLACE with a stat row: es «Modo: PVE» / en «Mode: PVE» |
| `:119` | both | «amount: 12 · unit: second» | DEV | REPLACE «12 s» |

### Rotaciones (`P/rotaciones/index.astro`; es L17-24 / en L27-34)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:20-21/:30-31` | both | «Las categorías del juego se muestran como afirmaciones de guía, no como hechos universales del canon Pokémon.» | DISC/META | DELETE |
| `:66` | both | «AVAILABILITY_SCOPE» | DEV | DELETE |
| `:67` (data) | es | «Special Shiny tiers — Primal Area availability» | I18N | REPLACE es «Tiers Shiny especiales: disponibilidad en Primal Areas» |
| `:22/:32`, `:71` | both | «AFIRMACIÓN ACTUAL» | META (data-model term) | DELETE the label |
| `:72` (data) | es | «Ultra Rare, Legendary and Mythic Shiny variants appear naturally only…» | I18N | REPLACE es «Las variantes Shiny Ultra Rare, Legendary y Mythic solo aparecen de forma natural en Primal Areas compatibles.» |
| `:23/:33`, `:78` | both | «excludedScopes: … · compatibilityCondition: …» | DEV | REPLACE es «No aparecen en respawns comunes ni en Wildscape. La especie debe estar configurada para esa Primal Area.» / en «They don't appear in common respawns or Wildscape. The species must be configured for that Primal Area.» |
| `:24/:34`, `:82-84` | both | «CONJUNTO COMPARADO: common respawn, Wildscape…» | DEV | DELETE |

### Herramientas hub (`P/herramientas/index.astro`; es L15-43 / en L46-71)
The recommendation is to DELETE this page (§8). If it is kept:

| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:16-17/:47-48` | both | «Utilidades integradas en la wiki…» | META/SEO | REPLACE es «Herramientas de PokeAlliance: comparar Pokémon, ranking de guild, mapa y comercio.» / en «PokeAlliance tools: compare Pokémon, guild ranking, map and trade.» |
| `:18-19/:49-50` | both | «…Cada una se habilitará cuando sus datos y límites estén suficientemente revisados.» | META | DELETE |
| `:20/:51` | both | h2 «Disponible» | META | DELETE |
| `:21/:52`, `:37-43/:66-71`, `:123-144` | both | Section «Siguiente en la hoja de ruta» (rotations and teams, hunts, calculators) | META (roadmap) | DELETE |
| `:22-24/:53-54`, `:95-103` | both | «Búsqueda del Codex» card | DUP (search is not a tool) | DELETE |
| `:27/:56` | both | «…observaciones comunitarias revisadas.» (false: none exist) | META | REPLACE es «Pokémon Center, Poke Mart y coordenadas por piso.» / en «Pokémon Centers, Poke Marts and coordinates by floor.» |
| `:28/:57` | both | «Preview disponible» | BADGE/I18N | DELETE |
| `:29/:58` | both | «Comparar Pokémon y tiers» | DUP/inconsistent | REPLACE es «Comparar Pokémon» / en «Compare Pokémon» |
| `:30-31/:59-60` | both | «…el roster público…» | META | REPLACE es «Compara dos variantes: tier, rol, nivel y tipos.» / en «Compare two variants: tier, role, level and types.» |
| `:32/:61`, `:36/:65` | both | «Disponible», «Disponible en local» | BADGE/META | DELETE |
| `:34-35/:63-64` | both | Guild description | trim | REPLACE es «Ranking semanal de tu guild a partir del export del juego.» / en «Weekly guild ranking from the game export.» |
| `:86` | both | Hidden eyebrow «Sección del Codex» | dead | DELETE |

### Guild ranking (`P/herramientas/guild.astro`, `C/tools/GuildRankingTool.tsx` es L195-372 / en L373-550, `C/tools/GuildPersistencePanel.tsx`, `src/lib/tools/guild-ranking.ts`)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `guild.astro:21/:30` | both | Hidden eyebrow «Herramientas / Guild» | dead | DELETE |
| `guild.astro:22-23/:31` | both | «Importa cortes diarios; el ranking ajusta las metas…» | INTRO | DELETE |
| `Tool:300/:478` | both | «Todavía no hay una guild cargada» | FILL | REPLACE es «Importa el export de tu guild» / en «Import your guild export» |
| `Tool:301/:479` | both | «…o pégalo en el campo anterior» / «…paste it above» (there is no field above) | wrong | REPLACE es «Sube el JSON que exporta el juego o pega su contenido.» / en «Upload the JSON the game exports or paste its contents.» |
| `Tool:1341` | both | Eyebrow «CLASIFICACIÓN» above the guild name | KICK (duplicates the tab) | DELETE |
| `Tool:1354-1355` | both | «Cobertura: 1 registro · 1 semana · 1 mes» | META | DELETE |
| `Tool:1358-1366` | both | «Guardado: Navegador (· Sin conexión)» | META | DELETE; when offline only, show es «Sin conexión: los cambios se guardan en este dispositivo.» / en «Offline: changes are saved on this device.» |
| `Tool:1441` | both | «America/Sao_Paulo» | DEV | DELETE |
| `Tool:1612` | both | «Cambios observados en los cortes de la semana.» | INTRO | DELETE |
| `Tool:355-356/533-534` (rendered `:1670`) | both | «Los miembros del primer snapshot se consideran anteriores al histórico. No se inventa su fecha de ingreso…» | META/DEV | DELETE |
| `Tool:350/528` | both | «No hay movimientos de miembros en los snapshots de esta semana.» | I18N («snapshots») | REPLACE es «Sin altas ni bajas esta semana.» / en «No members joined or left this week.» |
| `Tool:302/480` | es | «Historial de snapshots» | I18N | REPLACE es «Historial de cortes» / en «Snapshot history» |
| `Tool:316/494` (badge) | both | «Base de semana» | META | REPLACE es «Primer corte de la semana» / en «First snapshot of the week» |
| `Tool:201-202/379-380` | both | «…Cada fecha se registra al instante y permanece guardada en este navegador.» | META | REPLACE es «Puedes subir varios días a la vez.» / en «You can upload several days at once.» |
| `Tool:1784` | both | «Uno o varios archivos JSON» under the «Seleccionar JSON(s)» button | DUP | DELETE |
| `Tool:205/383` | both | Placeholder `{ "members": [...], "guild": "..." }` | DEV/PH | DELETE |
| `Tool:249/427`, `:553` | both | «ZONA HORARIA DEL EXPORT» with options `America/Mexico_City`, `UTC` | DEV | REPLACE label es «Hora del export» / en «Export time zone»; options es «Hora de Brasil (Server Save)», «Ciudad de México», «UTC» |
| `Tool:241/419` | both | «Contribución (dinero)» | noise | REPLACE es «Contribución» / en «Contribution» |
| `Tool:244/422` | both | «Vacío = desactivada» | tone | REPLACE es «Deja vacío para no evaluarla.» / en «Leave empty to skip.» |
| `Tool:1260` | both | Raw «2026-09-09 23:10:00» | DEV | REPLACE with a localized short date and time |
| `Tool:196-372` (about 60 keys) | both | Unreferenced strings, e.g. `:196` eyebrow, `:198-199` intro, `:250` «Se usa cuando exportedAt no trae offset horario.», `:292-293`, `:303-304`, `:329-330`, `:344-345` | dead META/DEV | DELETE. These were found by static grep for `strings.<key>`; confirm there is no dynamic access first. |
| `Persist:29/64` | both | Eyebrow «Cuenta y archivo» | KICK | DELETE |
| `Persist:31-32/66-67` | both | «…El servidor conserva un export por fecha de Server Save y reemplaza el anterior…» | META | REPLACE es «Inicia sesión para guardar el historial en tu guild.» / en «Sign in to save history to your guild.» |
| `Persist:33/68` | both | «La conexión con Supabase todavía no está configurada en este entorno.» | DEV | REPLACE es «El guardado en la nube no está disponible ahora.» / en «Cloud saving isn't available right now.» |
| `Persist:54-55/89-90` | both | «…Si Supabase solicita confirmación…» | DEV | REPLACE es «Cuenta creada. Revisa tu correo para confirmarla.» / en «Account created. Check your email to confirm it.» |
| `Persist:173,227,240` | both | Raw `error.message` from Supabase, in English | I18N/DEV | REPLACE with mapped messages, e.g. es «No se pudo iniciar sesión. Revisa tu correo y contraseña.» / en «Couldn't sign in. Check your email and password.» |
| `guild-ranking.ts:576-585` | both | «Membro» (Portuguese), «Vice-Líder», «Líder», shown on **both** /es and /en | I18N | REPLACE es «Miembro / Vicelíder / Líder» / en «Member / Vice-Leader / Leader» |
| `ui/dialog.tsx:63,96`, `ui/sheet.tsx:68` | es | Screen-reader text «Close» | ARIA/I18N | REPLACE with a locale prop: es «Cerrar» / en «Close» |

### Comparar Pokémon (`P/herramientas/pokemon.astro`; `C/tools/PokemonExplorer.tsx` es L20-55 / en L56-91)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `page:17/:26` | both | «…los tiers publicados por la wiki.» | META/SEO | REPLACE es «Compara dos variantes de Pokémon: tier, rol, nivel y tipos.» / en «Compare two Pokémon variants: tier, role, level and types.» |
| `page:18/:27` | both | Hidden eyebrow | dead | DELETE |
| `page:19-20/:28-29` | both | «…no hay recomendaciones inventadas ni fórmulas ocultas.» | DISC | DELETE |
| `Expl:22/58`, `:249` | both | «COMPARACIÓN DIRECTA» | KICK | DELETE |
| `Expl:24-25/60-61`, `:253` | both | «…Este resumen no calcula daño ni decide cuál Pokémon es mejor.» | DISC | DELETE |
| `Expl:26-27/62-63`, `:256-264` | both | Separate «Filtrar opciones» field that drives both selects | awkward | DELETE; use two comboboxes labelled es «Pokémon A / Pokémon B» |
| `Expl:30/66`, `:312` | both | Visible caption «Resumen comparado», same as the region label | DUP | Keep only as screen-reader caption: es «Comparación» / en «Comparison» |
| `Expl:35/71` | both | «Nivel mostrado» / «Displayed level» | DEV | REPLACE es «Nivel» / en «Level» |
| `Expl:39-41/75-77`, `:208-212` | both | Row «Ficha detallada: Disponible» | META (pipeline flag) | DELETE |
| `Expl:296` | both | Variant eyebrow on each record, repeated in the table | DUP | DELETE |
| `Expl:111` | both | Option «Shiny Bulbasaur · Shiny» | DUP | REPLACE «#001 Shiny Bulbasaur» |
| `Expl:222` | both | tablist aria «Comparar» | ARIA | REPLACE es «Modo» / en «Mode» |
| `Expl:21/57`, `:333-412`, `:42-44/78-80` | both | «Explorar tiers» tab with kicker «POKÉDEX» and its intro | DUP of the Pokédex filters | DELETE the tab. Update `smoke.spec.ts:469-470`. |
| `Expl:367` | both | Role option «—» | FILL | DELETE |
| `lib/tools/pokemon-roster.ts` (`getRosterElementsLabel`) | both | «grass · poison» in lowercase, while the Pokédex shows «Grass» | inconsistent | REPLACE with Title Case |

### Mapa (`P/mapa/index.astro` es L17-24 / en L27-35; `C/map/MapExplorer.tsx` es L30-55 / en L57-83)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `page:17/:27` | both | «Mapa del cliente» / «Client map» | DEV/DUP (nav says «Mapa») | REPLACE es «Mapa» / en «Map». Update `smoke.spec.ts:476`. |
| `page:39` | en | `title="Mapa"` hard-coded, so the en tab reads «Mapa · Alliance Codex» | I18N | REPLACE with `{copy.title}` |
| `page:18-19/:28-29` | both | «Preview interactivo … observados en el cliente…» | META/SEO | REPLACE es «Mapa de PokeAlliance por pisos: Pokémon Center, Poke Mart y coordenadas.» / en «PokeAlliance map by floor: Pokémon Centers, Poke Marts and coordinates.» |
| `page:20/:30` | both | Hidden eyebrow | dead | DELETE |
| `page:21-22/:31-32` | both | «…todavía no es un mapa semántico completo del mundo.» | META | DELETE |
| `page:23-24/:33-35`, `:55-58` | both | «Aportar al mapa · Formato para enviar observaciones sin publicarlas automáticamente. →» | META (dead end) | DELETE; later REPLACE with es «Reportar un error del mapa» / en «Report a map error» once a channel exists |
| `Map:40-42/67-69`, `:483-486` | both | «Límite de este preview: …snapshot OTMM… Minimap.flags…» | DEV | DELETE |
| `Map:36/63`, `:443` | both | Footer «Marcadores disponibles» | DUP | DELETE |
| `Map:46-47/73-74`, `:287-293` | both | «Marcadores del cliente 65 visibles» | DEV/DUP | DELETE |
| `Map:44/71` | both | «Otro marcador del cliente» | DEV | REPLACE es «Otros» / en «Other» |
| `Map:43/70` | both | «Sin etiqueta» | minor | REPLACE es «Sin nombre» / en «Unnamed» |
| `Map:34/61` | both | Placeholder «Pokémon Center, Poke Mart…» while the chips say «Pokemon Center» | inconsistent/PH | REPLACE es «Filtrar por nombre» / en «Filter by name»; confirm the canonical spelling from the client |
| `Map:54-55/81-82`, `:330-332` | both | Badge «Mapa base» | BADGE | DELETE; only when there is no image, show es «No hay imagen para este piso.» / en «No image for this floor.» |
| `Map:347-352` | both | «x 0–6655», «y 128–5503» | DEV | DELETE |
| `Map:469-475` | both | Rows `icon`, `flagId` | DEV/I18N | DELETE. Update `smoke.spec.ts:492`. |
| `Map:39/66` | both | «Selecciona un marcador para ver sus coordenadas.» | FILL, but useful | REPLACE es «Toca un marcador para ver sus coordenadas.» / en «Tap a marker to see its coordinates.» |
| `Map:371` | both | Control group aria «Centrar mapa» | ARIA | REPLACE with `role="group"`, es «Controles del mapa» / en «Map controls» |

### Aportar al mapa (`P/mapa/aportar.astro`; es L15-55 / en L58-99)
The recommendation is to DELETE the route until a submission channel exists. If it is kept:

| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:16-17/:59` | both | «Formato para enviar … para revisión manual.» | META/SEO | REPLACE es «Cómo reportar un punto del mapa de PokeAlliance.» / en «How to report a PokeAlliance map point.» |
| `:18/:60` | both | Hidden eyebrow | dead | DELETE |
| `:32/:73` | both | «spawn_area, hunt_entrance, npc, quest_point, travel_point u otro.» | DEV | REPLACE es «Spawn, entrada de hunt, NPC, punto de quest o de viaje.» / en «Spawn, hunt entrance, NPC, quest point or travel point.» |
| `:39/:83` | both | «Instante original en ISO; se mostrará localmente usando Temporal.» | DEV | DELETE the row |
| `:41-49/:85-93`, `:156-179` | both | Review-state table `pending_review`, `approved`… | META/DEV | DELETE. Update `smoke.spec.ts:498`. |
| `:50-52/:94-96`, `:181-187` | both | «LÍMITE ACTUAL: …todavía no existe un envío automático…» | META | DELETE |
| `:53-54/:97-98` | both | Privacy notice | KEEP, shorter: es «No compartas contraseñas ni datos de tu cuenta.» / en «Don't share passwords or account details.» |
| `:195-201` | both | Table of contents titled «Resumen» / «Summary» | ARIA/label | REPLACE es «En esta página» / en «On this page», or DELETE (the page is short) |

### Comercio (`P/comercio/index.astro`; `C/trade/TradeDesk.tsx` es L62-118 / en L120-178)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `page:26-27/:33` | both | Description | SEO | REPLACE es «Crea un anuncio de Pokémon, items, Diamonds o KKs y cópialo para publicarlo.» / en «Create a listing for Pokémon, items, Diamonds or KKs and copy it to post.» |
| `page:28-29/:34` | both | «…Los anuncios públicos aún no están habilitados.» | META | DELETE |
| `page:50` | both | «COMUNIDAD» | KICK | DELETE |
| `Desk:115/174`, `:340`, `:673` | both | «Borrador local» (twice) | META/BADGE | DELETE |
| `Desk:101/159`, `:341` | both | «Se compone en este navegador; aún no se publica ni guarda.» | META | DELETE |
| `Desk:74/132` | both | «…El catálogo aún no está completo.» | META | REPLACE es «Escribe el nombre tal como aparece en el juego.» / en «Use the name shown in-game.» |
| `Desk:76/134` | both | Placeholder «Busca en las 910 variantes del roster» | META/PH | REPLACE es «Nombre del Pokémon» / en «Pokémon name» |
| `Desk:117/176`, `:476` | both | «Opcional» | BADGE | DELETE |
| `Desk:80/138` | es | «Training skills» | I18N (the Spanish client says «Entrenamiento», owner screenshot 2) | REPLACE es «Entrenamiento» / en «Training» |
| `Desk:81/139`, `:544` | both | «Completa sólo los valores que puedas comprobar en el cliente.» | META | DELETE |
| `Desk:85/143`, `:579` | both | «…según la información facilitada por el propietario.» | META | DELETE |
| `Desk:83/141` | both | «Slots totales» | not the game label | REPLACE «Memory Slots» (game label, owner screenshot 1) |
| `Desk:86,88/144,146` | both | «Level», «Star level» | the game label is ambiguous | REPLACE «Star Level». «Level» vs «Required Level» needs owner confirmation. |
| `Desk:95/153` | es | «Next boost chance (%)» | I18N | REPLACE es «Probabilidad del próximo Boost (%)» / en «Next Boost chance (%)» |
| `Desk:107/165`, `:719` | both | «Datos declarados para esta unidad» | META | DELETE |
| `Desk:110/168`, `:730` | both | «Precio NPC: aún no verificado en el catálogo» | META | DELETE. Update `smoke.spec.ts:146`. |
| `Desk:111/169-170`, `:539` | both | «…nombres declarados, todavía sin catálogo validado.» | META | DELETE |
| `Desk:116/175`, `:765` | both | RMT rule at 10px | needed notice | KEEP, rewritten at ≥12px: es «Las ventas por dinero real se acuerdan fuera de los canales oficiales del juego. Cada jugador es responsable de su trato.» / en «Real-money sales are arranged outside official game channels. Each player is responsible for their deal.» |
| `Desk:77/135`, `:736-745` | both | «Elige un Pokémon de la lista.» shown on page load | premature error | KEEP the text; show it only after the player interacts |
| `Desk:552,562` | es | aria «Attack level» / «Attack progress» | ARIA/I18N | REPLACE es «{skill}: nivel», «{skill}: progreso (%)» |
| `Desk:766-771` | both | Read-only textarea copy of the preview | DUP | DELETE; show it only when clipboard copy fails |
| `Desk:421` | both | Placeholder «Normal charger» | PH (example) | KEEP (canonical item name) |

### Cambios (`P/cambios/index.astro`; es L15-19 / en L22-26)
| `:17/:24` intro, `:41` hidden eyebrow, `:47` «SIN ENTRADAS TODAVÍA» + `:18/:25` «El registro todavía no tiene entradas publicadas.» + `:19/:26` «Las novedades se incorporarán aquí…» | both | Three layers of empty state | FILL/META | DELETE the page from nav (noindex) until there are entries. If kept, one line: es «Aún no hay cambios publicados.» / en «No changes published yet.» Update `smoke.spec.ts:473`. |
|---|---|---|---|---|

### Buscar (`P/buscar/index.astro`; es L35-40 / en L43-47; `C/wiki/ContentSearch.tsx` es L25-29 / en L32-36)
| file:line | loc | current | cat | action |
|---|---|---|---|---|
| `:35/:43` | both | «Buscar en el Codex» | DUP/jargon | REPLACE es «Buscar» / en «Search»; with a query: es «Resultados para «{q}»» / en «Results for "{q}"» |
| `:36-37/:44` | both | «…registros normalizados…» | DEV/SEO | REPLACE es «Busca Pokémon, items, quests y sistemas de PokeAlliance.» / en «Search PokeAlliance Pokémon, items, quests and systems.» |
| `:38/:45` | both | Hidden eyebrow «Wiki Core / Search» (English on es) | dead/I18N | DELETE |
| `:39-40/:46-47` | both | «La búsqueda recorre el catálogo disponible…» | INTRO | DELETE |
| `:28` | both | Row meta `normal`, `shiny`, `training_charger`, `city` | DEV | REPLACE with localized labels (show «Shiny» only for shiny) or DELETE |
| `CS:116` | both | «POKÉMON» kicker repeated on every row (×60) | KICK | REPLACE with a sprite slot or type chip, or group results under one heading per collection |
| `CS:27/34`, `:100-105` | both | «915 RESULTADOS» in mono capitals | style | KEEP the count in sentence case |
| `CS:28/35` | both | «No hay registros que coincidan…» | DEV («registros») | REPLACE es «Sin resultados para «{q}».» / en «No results for "{q}".» |
| `CS:107-127` | both | With no query, lists all 915 records | FILL | REPLACE: show nothing (or suggestions) until the player types |

---

## 3. Fake or broken controls and dead UI

1. **The global search ignores the query (verified).** Every page's top-bar form posts to `/{l}/buscar/?q=…`, but the page is prerendered. `P/buscar/index.astro:49` reads `Astro.url.searchParams` at build time, so `ContentSearch.tsx:50` starts with an empty query. Result on `/es/buscar/?q=charizard`: 915 results and an empty box (`SHOTS/es-buscar-q-desktop.png`). The Pokédex has the same bug at `P/pokedex/index.astro:54` / `PokedexGrid.tsx:91`. **Fix:** read `location.search` on mount and keep the URL in sync.
2. **Fake top-bar icons.** Panel and moon icons at `AppLayout.astro:140-155` (CSS at `S/wiki-reference.css:264-280`) look like buttons and do nothing. **Delete them.** The site is dark-only.
3. **The language switch pretends to be a dropdown and loses the page.**
   - A dropdown chevron sits on a plain link (`AppLayout.astro:138`).
   - The link and `hreflang` always go to the root (`:97-98`, `:132`).
   - **Fix:** replace the locale segment in the current path and keep the query string; delete the chevron.
4. **"Ctrl K" hint with no handler** (`WikiSearch.tsx:44`). **Delete it,** or add a global shortcut that focuses the top-bar search, with `aria-keyshortcuts`, shown only on fine-pointer devices.
5. **Server Save date frozen at build.** `P/index.astro:20` calls `Temporal.Now` inside a prerendered page, so production shows the build day's save forever. **Compute it on the client, or delete the card.**
6. **"Datos de la ficha" is always empty.** `[slug].astro:51-63` filters out every fact key the roster has, and `:187-207` still renders the heading plus «6 campos». This affects all 910 pages. **Delete the section.**
7. **Arrow icons that suggest links.**
   - `guias:153,159` puts up-right arrows on items that are not links.
   - `P/index.astro:108,115,150` uses "external" up-right arrows on internal links.
   - **Delete them,** or use a right chevron on real links.
8. **Wrong icons.**
   - The Guías card uses a magnifier (`P/index.astro:82`).
   - Sparkles for Guías (`AppLayout.astro:48`).
   - Swords reused for Rotaciones and Comparar (`:50,:58`).
   - Map icon reused for Mapa and Aportar (`:66,:76`).
   - **Give each item a distinct, meaningful icon.**
9. **OutfitPreview aura buttons.**
   - «Sin aura» is drawn as an Ultra Ball (`OutfitPreview.tsx:258-275`).
   - All aura buttons are icon-only with a tooltip title (`:276-311`).
   - Their selected state is a glow (`S/wiki-reference.css:2833,2864`).
   - **Fix:** visible text labels; selection shown by a blue ring plus a check.
10. **Guild empty state points to a field that does not exist:** «campo anterior» (`GuildRankingTool.tsx:301`).
11. **Guild layout breaks when a guild is loaded.**
    - At 1440, the Metas, Cuenta and Exportar buttons render outside the header card (x≈1160–1380, while the card ends at 1175).
    - At 1440, the table's ESTADO and ACCIONES columns are clipped. Only the 2px coloured left stripe remains (`S/wiki-reference.css:4784-4792`), so status is shown by colour alone.
    - At 390, «Por debajo» wraps inside its badge and gets clipped, and the row «⋯» action is cut off at the edge.
    - Screenshots: `SHOTS/states/es-guild-loaded-{desktop,mobile}.png`.
12. **Map cursor readout is clipped:** «Cursor 1721, 215…» spills out of its control box (`MapExplorer.tsx:402-409`; `S/global.css:1018`). Screenshots: `SHOTS/es-mapa-desktop.png`, `states/es-mapa-selected-desktop.png`.
13. **Map has two separate filter systems.**
    - Category chips (`MapExplorer.tsx:258-276`) and layer toggles (`:294-317`) keep separate state.
    - The «Marcadores del cliente» row (`:287-293`) looks like a toggle but is not one.
    - The «Mapa base» badge (`:330-332`) looks like a chip.
    - Floor and category buttons expose their state only through `data-active` (`:236-244, :260-274`).
    - The floor ↑/↓ buttons (`:411-436`) duplicate the floor chips.
    - **Fix:** one control group with radio semantics and counts.
14. **Map markers are 12×12px targets** (×130; `S/global.css:831`). **Fix:** a ≥24px hit area with the same visual dot.
15. **Comercio decoration and a misleading Ditto.**
    - The header Poké Ball tile looks like an icon button (`P/comercio:54-56`).
    - The preview repeats its sprite (`TradeDesk.tsx:676-688`).
    - The "Pokémon" asset tile is a hot-linked Ditto (`:186`), and the preview shows Ditto before anything is chosen (`:257-262`).
    - **Fix:** neutral Poké Ball placeholder; delete the duplicates.
16. **Comercio live region and validation.**
    - `aria-live` wraps the whole preview (`TradeDesk.tsx:707`), so screen readers re-announce it on every keystroke.
    - Validation shows on first load (`:736-745`).
    - Sell/Buy and the asset tiles use `aria-pressed` for what are single-choice radios (`:352-363`, `:368-396`).
17. **Herramientas roadmap rows** (`herramientas:128-142`) are not interactive but look exactly like the linked rows above them (`:105-119`).
18. **Dead-end pages.** Aportar al mapa has no submission path and is linked from the nav (`AppLayout.astro:73-77`) and the map header (`mapa:55-58`). Cambios is empty and linked from the nav (`:71`).
19. **Duplicate "Clear filters"** in the Pokédex (`PokedexGrid.tsx:279-283`, `:350-352`).
20. **PokemonExplorer.**
    - The tier list renders all 910 rows at once (`:388-408`).
    - Select text is truncated at 1440: «Todas las funcione», «Todas las variante» (`SHOTS/states/es-pokemon-tiers-desktop.png`).
    - Tabs have no `aria-controls` or tabpanel and no arrow-key navigation (`:222-245`).
21. **Mobile Pokédex.**
    - The sticky toolbar takes about 215px of an 844px screen while scrolling (`SHOTS/seg/es_pokedex-mobile-1.png`).
    - The `/` key hint shows on touch devices (`PokedexGrid.tsx:195`).
    - Placeholder and select labels are truncated.
22. **Mobile nav.** It flattens 13 links with no group headings, uses 34px rows, and its visible label is «Navegación principal» (`AppLayout.astro:231-245`).
23. **Blur on overlays** (not allowed in the new system): `ui/dialog.tsx:29`, `ui/sheet.tsx:31` (`backdrop-blur-xs`), and the map legend (`S/global.css:877`).
24. **No 404 page.** Add `src/pages/404.astro` in both languages:
    - es: «No encontramos esta página.» with the link «Ir al inicio»
    - en: «We couldn't find this page.» with the link «Go home»
25. **"Ver JSON" developer dialog** (`GuildRankingTool.tsx:1825-1833`). Move it into an overflow menu.

---

## 4. Game-layer candidates

| # | Surface (file:line) | Priority | Why and how |
|---|---|---|---|
| 1 | Pokédex infobox (`[slug].astro:122-174`: number, name, types, stats dl, variant picker) | **Corte 0 pilot** | This is the canonical game entity and already a dl.<br>Card #1D232B; Poppins name; stat rows «Tier:», «Rol:», «Nivel:», «Generación:» with white tabular values.<br>Keep the type colours (`--dex-*`).<br>Delete the eyebrow and the empty facts section. |
| 2 | Pokédex grid card (`PokedexGrid.tsx:294-342`) | **Corte 0 pilot** | Highest-traffic entity surface.<br>Poppins name; tier as a neutral chip (not gold, unless it is a label); keep type chips.<br>Drop the duplicate variant text; tiny text goes up to 12–13px.<br>Name only the clicked card for the view transition (`:315` currently names every card). |
| 3 | `UnitTooltip` shown in the Comercio preview (`TradeDesk.tsx:670-772`) | **Corte 0 build** (component and gallery only) | Closest match to owner screenshot 1.<br>Build it as the design-system reference with labelled synthetic data (critique item 40); the preview can consume it.<br>Comercio behaviour changes stay for later cortes.<br>Includes «Held Items: N» and «Entrenamiento: N» sections, the 12px green training meter with % outside the bar, and a beveled SpriteSlot. |
| 4 | OutfitPreview (`OutfitPreview.tsx:213-320`) | Corte 0, next to #1 | Beveled sprite slot for the outfit; aura buttons as ball chips with text labels; no glow. |
| 5 | Compare records and table (`PokemonExplorer.tsx:292-330`) | Later (tools corte) | Two tooltip cards side by side replace the generic table; a "coincide" state uses the blue ring plus text. |
| 6 | Sistemas item and move cards (`sistemas:77-85, 97-123`) | Later (catalogs) | Item card: sprite slot plus stat rows «Elemento:», «Slot:», «Cooldown: 12 s». |
| 7 | Guías quest card (`guias:82-126`) | Later | Stat row «Nivel requerido: 200»; rewards as item slots with quantity; the steps stay in the shell (prose). |
| 8 | Map marker detail (`MapExplorer.tsx:447-480`) | Later | Small tooltip: «Pokémon Center», «Coordenadas: 1721, 2158, 7», a copy button. |
| 9 | Search result rows (`ContentSearch.tsx:110-125`) | Later | Shell row plus a mini sprite slot and a type chip, replacing the «POKÉMON» kickers. |
| 10 | Trade asset tiles (`TradeDesk.tsx:368-396`) | Later (Comercio) | SpriteSlot, radio-group semantics, blue selection instead of gold. |
| — | Guild ranking, Aportar, Cambios, Herramientas | Shell only | Not game entities. Guild tier chips and the «Premium» badge stay in shell colours; gold currently used there must go (`S/wiki-reference.css:3306`). |
| — | Home roster (`P/index.astro:112-132`), Rotaciones card | Not migrated | Delete or rewrite them rather than reskin. |

---

## 5. Migration notes

**Token source**

The same values are defined twice (and one set a third time):
- `S/wiki-reference.css:7-32` (`--wiki-*`)
- `S/global.css:31-57` (shadcn)
- `S/global.css:2440-3364` (`@layer legacy-wiki`, with conflicting values at `:2442-2451`)

Consolidate into `--cx-*` and keep temporary `--wiki-*` aliases. Mapping:

| Current | Target |
|---|---|
| `--wiki-page-bg` #0c0e12 | `--cx-canvas` #0F1318 |
| `--wiki-surface-secondary` #13161b | `--cx-surface` #161B22 |
| `--wiki-hover` #22262f | `--cx-raised` #262B32 |
| `--wiki-line` #22262f | `--cx-line` #2E3540 |
| `--wiki-line-strong` #373a41 | `--cx-line-strong` #646D7C (control borders) |
| `--wiki-copy` #f7f7f7 | `--cx-copy` #EEF0F3 (body) / `--cx-value` #FEFEFE (values) |
| `-secondary` #cecfd2 | `--cx-copy-2` #B6BCC6 |
| `-tertiary` #94979c, `-disabled` #85888e | `--cx-muted` #8A919C |
| `-quinary` #61656c (fails contrast) | `--cx-muted` |
| `--wiki-link` #93c5fd, `--wiki-focus` #444ce7 | `--cx-blue-hi` #68C0FF |
| `--wiki-brand-blue` #3b9fd8 | `--cx-blue` #3AA6F6 |
| `--wiki-brand-gold` #e8a238 and the other golds | `--cx-gold` #E8C66A |
| success #47cd89 | #4ADE80 |
| error #f97066 | #F87171 |

`-quinary` (#61656c) is used at `S/wiki-reference.css:380,401,439,487,504,799,1070,1097,4701`. The other golds are #d7a05d (`S/global.css:2451`), #f3cc62, #e3bd5b, #e7bb57 and the oklch golds in `S/home.css:39,85` and `S/trade.css`.

shadcn tokens:
- `--primary` becomes `--cx-blue` with ink #0B1A2B.
- `--accent` and `--ring` become `--cx-blue-hi`.
- `--border` becomes line; `--input` becomes line-strong.

Other fixes:
- `S/global.css:83` `::selection` #3730a3: use a blue tint.
- `AppLayout.astro:94` theme-color #111318: use #0F1318.

**Dark mode**
- There are 24 `dark:` variants in `ui/*`, for example `button.tsx:12,16,18`, `badge.tsx:7,14,16`, `input.tsx:11`, `tabs.tsx:51-53`, `textarea.tsx:9`.
- **Fix:** add `@custom-variant dark` and set `class="dark"` on `<html>` (`AppLayout.astro:89`).

**Fonts**
- `S/global.css:32-34` sets Verdana for both body and display: use Inter Variable for body and Poppins 600/700 for display and game labels, self-hosted.
- `--font-code` (mono) is used for labels and numbers in about 50 rules. Examples: `S/global.css:154,200,306,341,417,443,474,612,809,901,963` and `S/wiki-reference.css:402,1036,1098,1247,1868,1876,1988,2092,2158,2238,2296,2307,2357,2382,2521,2596,2616,2679,2893,2943,4349,4419,4601,4702,4757`.
- These become Inter with tabular-nums for numbers, or Poppins stat-row labels. Keep mono only for coordinates and IDs.
- The `.eyebrow` class (`S/global.css:339-345`, `S/wiki-reference.css:444-450`): mono, uppercase, letter-spaced, 10–11px. Delete it.

**Type sizes**

Declarations below 12px: `global.css` 87 of 154, `wiki-reference.css` 76 of 150, `trade.css` 21 of 33, `guides.css` 5 of 14, `home.css` 4 of 11 (193 in total).

The worst offenders:

| px | Selector | Location |
|---|---|---|
| 8.96 | `.map-zoom-level`, `.map-coordinate-readout` | `global.css:1018` |
| 8.96 | `.wiki-brand-subtitle` | `global.css:2494` |
| 9.12 | `.pokemon-tier` | `wiki-reference.css:2297` |
| 9.28 | `.pokemon-profile-stats dt` | `wiki-reference.css:2597` |
| 9.28 | `.map-legend small` | `global.css:902` |
| 9.28 | `.map-base-badge` | `global.css:964` |
| 9.28 | `.pokemon-variant-picker > span` | `wiki-reference.css:2617` |
| 9.44 | `.pokemon-card-meta` | `wiki-reference.css:2308` |
| 9.44 | `.map-axis-label` | `global.css:810` |
| 9.6 | `.pokedex-roster-count` | `wiki-reference.css:1869` |
| 9.76 | `.map-drag-hint` | `global.css:1038` |
| 9.76 | `.outfit-preview-caption/label` | `wiki-reference.css:2680` |
| 9.92 | `.trade-preview-intent` | `trade.css:498` |
| 9.92 | `.trade-copy-text` | `trade.css:644` |
| 9.92 | `.codex-home-roster-heading` | `home.css:125` |
| 10 | `.wiki-sidebar-note` | `wiki-reference.css:403` |
| 10 | `kbd` | `ui/kbd.tsx:8` (`text-[10px]`) |
| 10.08 | `.trade-rule` | `trade.css:581` |
| 10.24 | `.tool-field > span` | `global.css:1207` |
| 10.24 | `.trade-page-kicker` | `trade.css:21` |
| 10.4 | `.guide-quest-label` | `guides.css:33` |
| 10.4 | `.pokemon-profile-back` | `wiki-reference.css:2961` |
| 10.4 | `.trade-help` | `trade.css:273` |
| 10.4 | `.wiki-data-row-meta` | `global.css:613` |
| 11 | `.status-label` | `wiki-reference.css:1260` |
| 11.04 | `.trade-field-label` | `trade.css:120` |
| 11.2 | `.codex-home-route-grid small` | `home.css:317` |
| 11.2 | `.pokemon-card-number` | `wiki-reference.css:2159` |

Map these to the 12 / 13 / 14 / 16 / 20 / 24 tokens.

Measured on the rendered pages, visible text elements below 12px per page (es, 1440): Pokédex 280, search 123, Comercio 57, map 41, detail 26, home 17.

**Radii**

There are about 30 distinct values. Target: 0 for bars, 6 for controls and chips, 8 for cards, 12 for shell panels, bevel for slots.
- 3px, 4px, 5px, 0.3–0.35rem (e.g. `global.css:197,271,873,912,959,995`; `trade.css:69,136,371,782,968`): 6.
- 0.45–0.65rem (`home.css:61,84`; `trade.css:128,167,237,602,639,715,746,765`; `wiki-reference.css:1948,1996,2728,2909,2958`): 8.
- 0.75–1.2rem (`home.css:13`, `wiki-reference.css:1771` at 1.125rem; `:2472` at 1.2rem; `:1936`; `trade.css:12,51,90`; `guides.css:11`): 12.
- 999px pills (`global.css:220,829`; `wiki-reference.css:2321`): 6.

**Shadows, glow, blur**
- `wiki-reference.css:1773` (masthead), `:1939` (toolbar), `:2474` (profile hero): e0 (none).
- `wiki-reference.css:2134` (card hover): e1.
- `global.css:875` (map legend): e2, and remove the blur at `:877`.
- Gold focus halos at `global.css:173,737,1619,1730,1810,2508,2917`: a 2px `--cx-blue-hi` outline.
- Gold map markers at `global.css:831,854,933`: domain marker tokens, with a blue ring for selection.
- Glows at `wiki-reference.css:2833,2864`: delete.
- Sprite drop-shadows at `guides.css:101`, `home.css:205`, `trade.css:846,938`, `wiki-reference.css:2203,2533`: delete, or one shared token.
- Dialogs and sheets (`ui/dialog.tsx:29,51`, `ui/sheet.tsx:31`, `ui/dropdown-menu.tsx:41,138`): remove the blur; e2 shadow; opaque scrim.

**Side stripes wider than 1px** (not allowed)
- `global.css:270/2566` (sidebar link, 2px)
- `:1242` (`.compare-record`)
- `:1636,1848,1862,3317`
- `wiki-reference.css:4477`
- `wiki-reference.css:4784-4792,4906` (guild rows)
- `guides.css:210-222` (the green icon column in the location card)

Replace them with a status chip (icon plus text) or a 1px border.

**Selection states**

They are inconsistent today:

| Surface | Colour | Location |
|---|---|---|
| Map | gold | `global.css:717-719` |
| Trade | gold | `trade.css:787-788,823-825` |
| Pokédex variant switch | red | `wiki-reference.css:2026` |
| Outfit direction | type colour | `wiki-reference.css:2751-2753` |
| Aura | glow | `wiki-reference.css:2850` |

Unify to a blue ring plus icon plus text. Pokédex red may stay as the domain fill on the masthead only.

**Gold misuse in the shell**
- Guild primary button (`wiki-reference.css:3306-3310`)
- Home CTA (`home.css:78-100`) and gold bar (`home.css:28-37`)
- Trade labels, CTA and selected states (`trade.css:723,777,949,969-980`)

Gold becomes game labels, the compact meter, and at most one CTA per screen.

**Bespoke classes that should become components**

| Current classes | Target component |
|---|---|
| `.pokemon-profile-stats`, `.pokemon-detail-facts` | `StatRow` |
| `.pokemon-card*` | `GameCard` |
| `.outfit-preview-*`, `.trade-asset-art`, `.trade-input-with-sprite` | `SpriteSlot` |
| `.trade-preview-*` | `UnitTooltip` |
| `.trade-training-row` | `Meter` (preview) plus a form row |
| `.status-label` | `Badge` |
| `.map-filter-button`, `.map-category-button`, `.pokedex-variant-switch`, `.trade-switch`, `.guild-status-strip` | `ToggleGroup` / `RadioGroup` |
| `.tool-tab` | `ui/tabs` |
| `.wiki-data-row` | list row |

- Delete the first skin of `trade.css` (`:1-701`) and the dead rules at `:196-214` and `:439-490`.
- Delete the guild CSS that hides content once data is loaded (`wiki-reference.css:5085-5125`) together with the markup it hides.

**Touch targets**
- `ui/button.tsx:23,27` (`h-8`, `size-8`) and `:24-25,29,31` (xs and sm): 40px.
- `ui/input.tsx:11` (`h-8`) and `ui/tabs.tsx:17` (`h-8`): 40px.
- Sidebar links are 28px (`wiki-sidebar-link`). Other undersized targets: trade toggles 32px, map chips 29–33px, map controls 28px, outfit direction 36px, top-bar controls 36px.

**Motion**
- `S/global.css:69` smooth scroll has no reduced-motion guard.
- `S/wiki-reference.css:1735-1742` view-transition timing: move to d1–d5 tokens.
- `PokedexGrid.tsx:315` and `[slug].astro:139`: name only the clicked card, via pageswap/pagereveal.
- Add `motion-reduce:animate-none` in `ui/dialog`, `ui/sheet`, `ui/dropdown-menu`.
- `src/lib/tools/guild-ranking-image.ts` has 11 hard-coded hex colours; move them to tokens.

**Tests that lock in current copy or design**
- `tests/e2e/smoke.spec.ts:16,161` (home heading)
- `:33` («Datos de la ficha»)
- `:79` («Outfit del juego · #»)
- `:146` («Precio NPC…»)
- `:173` (Verdana)
- `:190` (shadow)
- `:469-470` (tiers tab)
- `:473` (Cambios)
- `:476` («Mapa del cliente»)
- `:492` («flagId»)
- `:498` («pending_review»)

Update them deliberately with the changes.

---

## 6. Language parity and accessibility

**Language parity**
- **English on /es pages:**
  - Quest, location, item, move and rotation data (Guías, Sistemas, Rotaciones).
  - «QUEST» (`guias:85`), «Training skills», «Level», «Nickname», «Next boost chance», «Star level» (TradeDesk).
  - `icon`/`flagId` (map), «Close» (ui), «Wiki Core / Search» (hidden), raw enums.
- **Portuguese or Spanish on /en pages:**
  - «Membro», «Vice-Líder» (`guild-ranking.ts:576-585`).
  - «Mapa» in the tab title (`mapa:39`).
  - alt «…sprite de PokeAlliance» (`[slug]:136`).
  - Default description (`AppLayout.astro:38`).
- **Number formats disagree:**
  - Guild uses pt-BR (`formatGuildNumber` default, `guild-ranking.ts:565`; 13 call sites), so /en shows «1.300».
  - Trade always uses en-US (`draft.ts:17`).
  - Data strings are hard-coded «5,000,000».
  - **Fix:** use `Intl.NumberFormat` with es-419 (or es-MX) and en-US; the owner decides which es variant.
- **Mixed vocabulary** (items vs objetos, quests vs misiones) across search boxes, collection labels and Sistemas.
- **Language switch and `hreflang`** point to the root on every page (`AppLayout.astro:97-98,130-139`); no `x-default`.

**Contrast** (measured)
- Current breadcrumb item #61656c at 12px: 3.3:1 on every page (`S/wiki-reference.css:487`).
- Sidebar note: 3.3:1 at 10px (`:401`).
- Map axis labels: 4.08:1 at 9.4px (`S/global.css:810`).
- Focus ring #444ce7: 3.16:1 (`S/wiki-reference.css:29`).
- Text over images and colour fills (Pokédex masthead, card tiers, trade gold on #282d2e) could not be measured automatically; check them after the reskin.

**Semantics**
- `aria-label` on role-less divs, which is ignored: `P/index.astro:112`, `PokedexGrid.tsx:219`, `MapExplorer.tsx:234,258,280,371,411`.
- Wrong labels: sort select, variant legend, tablist «Comparar», prev/next nav «Resumen», map controls «Centrar mapa».
- `aria-pressed` used for single-choice groups: TradeDesk intent and asset, map (no state exposed at all), Pokédex variant switch. These should be radio groups.
- Tabs without panels: `PokemonExplorer.tsx:222-245`.
- Whole-preview live region: `TradeDesk.tsx:707`.
- Validation messages not linked to fields with `aria-describedby`.
- Status shown by colour only when the guild table is clipped (§3 item 11).

---

## 7. Top 10 fixes, ranked

1. **Fix search filtering on prerendered pages.** Buscar and Pokédex ignore the query (§3.1). The top-bar search on every page lands on an unfiltered list.
2. **Remove developer and pipeline text everywhere.**
   - Map OTMM note, `icon`/`flagId`, axis labels.
   - Rotaciones enums and object keys.
   - Sistemas `amount: … unit: …`, TRAINING_CHARGER.
   - Guías `mode:/command:`, CITY.
   - ServerSaveStatus «Temporal» and IANA zones.
   - Supabase messages; raw `error.message`.
3. **Delete kickers, intros, disclaimers and status badges on every page**, including the CSS-hidden eyebrows and the CSS hack at `S/wiki-reference.css:512-514`. Also delete the Herramientas hub (roadmap and status badges), the Comercio «Borrador local» strip, and the Pokédex masthead widgets.
4. **Delete the always-empty "Datos de la ficha" section** on all 910 Pokédex pages, and rebuild the infobox as the first stat-row card (Corte 0 pilot #1).
5. **Remove fake controls and dead ends:** top-bar panel and moon icons, locale chevron, «Ctrl K», «Mapa base» badge, non-link arrows, Ultra Ball «Sin aura», and the Aportar and Cambios nav entries and pages until they have content.
6. **Make the locale switch keep the current path** and fix `hreflang`. Remove Portuguese/English leaks on /en (Membro, «Mapa», alt text) and localize the /es data strings.
7. **Consolidate tokens into `--cx-*`.** Delete `@layer legacy-wiki` and the first `trade.css` skin; bring text to a 12px minimum (193 declarations); focus ring to #68C0FF; unify selection to a blue ring plus text instead of gold/red/type/glow.
8. **Fix the guild workspace layout:** header actions overflow, table columns and badges clipped, colour-only status. Localize ranks and numbers; remove the Cobertura/Guardado/zone meta.
9. **Rebuild the Pokédex grid card** in the game voice (Corte 0 pilot #2): one variant signal, 12–13px meta, view-transition name only on the clicked card, a lighter mobile sticky toolbar with no `/` hint on touch.
10. **Build `UnitTooltip`, `StatRow`, `Meter` and `SpriteSlot` in a labelled-fixture gallery,** make the Comercio preview their first consumer, and cut the Comercio meta copy: 8 meta strings, the duplicate textarea, the Ditto placeholder, the premature error, and the English labels («Entrenamiento», «Memory Slots»).

---

## 8. Per-page verdict

Screenshot names are relative to `SHOTS/`. Each route also has `.txt` and `.json` files beside its shots, and `seg/` crops where noted.

**Home `/es/` `/en/`.** A launcher for the wiki. Cut the kicker, the tagline, the duplicate search CTA, the starter roster and the Server Save card (frozen date, raw zones). Keep one search box, the four section cards and the Server Save fact in the sidebar. Codex Tooltip version: a functional search heading plus shell section cards; no game layer here.
- Shots: `es-home-{desktop,mobile}.png`, `en-home-*.png`, `es-root-*.png`, `seg/es-{desktop,mobile}-{0,1}.png`, `states/{es,en}-mobile-nav-open-mobile.png`.

**Pokédex `/pokedex/`.** Find a Pokémon fast. Cut the masthead (kicker, intro, fake lights, 910 counter, watermark), the triple variant signal, the duplicate "clear filters" and the mis-labelled controls. Keep search, variant, generation and type filters, sort, and the grid with type colours. Codex Tooltip version: blue-graphite game cards with Poppins names and neutral tier chips, 12px or larger; a compact sticky toolbar.
- Shots: `{es,en}-pokedex-{desktop,mobile}.png`, `seg/es_pokedex-{desktop,mobile}-{0,1,2}.png`, `states/{es,en}-pokedex-empty-{desktop,mobile}.png`.

**Pokédex detail `/pokedex/charizard/`, `/pokedex/shiny-ditto/`.** The answer card for one species. Cut the «POKÉDEX» eyebrow, the empty «Datos de la ficha / 6 campos», the outfit ID, «Premier · prueba» and the Ultra Ball "no aura". Keep the number, name, types, tier/role/level/generation, variants, outfit viewer and previous/next. Codex Tooltip version: the Corte 0 pilot infobox with gold «Tier:» labels and white values; outfit in a beveled slot; a real meta description.
- Shots: `{es,en}-pokedex-charizard-*.png`, `{es,en}-pokedex-shiny-ditto-*.png`, `seg/es_pokedex_charizard-*`.

**Guías `/guias/`.** Should be quest walkthroughs, but today it is 1 sample quest and 1 location in English. Cut the intro, counts, «QUEST», ✦, raw kind/mode/command and fake arrows. Keep steps, rewards and required level. Codex Tooltip version: a quest header card (stat row «Nivel requerido:», rewards as item slots) with shell prose steps. Hide the page until there is real, localized data.
- Shots: `{es,en}-guias-*.png`, `seg/es_guias-*`.

**Sistemas `/sistemas/`.** Item and move reference, today 1 item and 1 move. Cut the intro, counts, TRAINING_CHARGER and the raw cooldown object. Keep name and description (localized). Codex Tooltip version: item and move tooltip cards with «Elemento:», «Slot:», «Cooldown: 12 s». Hide until there is data.
- Shots: `{es,en}-sistemas-*.png`, `seg/es_sistemas-*`.

**Rotaciones `/rotaciones/`.** Tier and availability rules, today one research record full of developer keys. Cut the disclaimer intro, AVAILABILITY_SCOPE, «Afirmación actual», «Conjunto comparado» and the raw keys. Keep the rule, rewritten in Spanish. Codex Tooltip version: shell prose plus tier chips; align the nav name. Hide until there is data.
- Shots: `{es,en}-rotaciones-*.png`, `seg/es_rotaciones-*`.

**Herramientas `/herramientas/`.** A hub that repeats the sidebar. Cut everything: intro, «Disponible», status badges, roadmap, the search card. Recommend deleting the route; the sidebar group is enough. If it is kept, show 4 plain links (Comparar, Guild, Mapa, Comercio).
- Shots: `{es,en}-herramientas-*.png`, `seg/es_herramientas-*`.

**Comparar Pokémon `/herramientas/pokemon/`.** Side-by-side comparison of two variants. Cut the disclaimer intro, the kicker, «Ficha detallada», «Nivel mostrado», the separate filter field and the whole «Explorar tiers» tab (a duplicate of the Pokédex). Keep two pickers and the comparison. Codex Tooltip version: two tooltip cards side by side, with differences marked by a blue ring plus text (later corte).
- Shots: `{es,en}-herramientas-pokemon-*.png`, `seg/es_herramientas_pokemon-*`, `states/{es,en}-pokemon-tiers-{desktop,mobile}.png`.

**Ranking de guild `/herramientas/guild/`.** A real working tool. Cut the intro, the «Clasificación» eyebrow, Cobertura/Guardado, the IANA zone, the snapshot meta paragraphs, «Base de semana» and Supabase wording. Keep import, the status strip, the ranking table, tabs, goals, account and export. Codex Tooltip version: shell only (Inter, tabular numbers, blue primary, no gold), fixed header and table overflow, status as chip plus text, localized ranks and numbers.
- Shots: `{es,en}-herramientas-guild-*.png`; `states/{es,en}-guild-{import-dialog,loaded,tab-actividad|activity,tab-historial|history,goals-sheet,account-sheet,member-sheet}-{desktop,mobile}.png`.

**Mapa `/mapa/`.** Find Pokémon Centers, Marts and coordinates by floor. Cut «Mapa del cliente», the intro, the contribute line, the OTMM note, the «Mapa base» badge, axis labels, `icon`/`flagId` and the duplicate layer legend. Keep the floor selector, one category filter with counts, zoom, the cursor and the coordinates panel with a copy action. Codex Tooltip version: shell toolbar plus a small marker tooltip card; markers at least 24px hit area; fix the clipped readout.
- Shots: `{es,en}-mapa-*.png`, `seg/es_mapa-*`, `states/{es,en}-mapa-selected-{desktop,mobile}.png`.

**Aportar al mapa `/mapa/aportar/`.** Describes a submission flow that does not exist. Cut the review-state table, «Límite actual», ISO/Temporal and the raw enums. Keep only the privacy line and the list of what to report, once a real channel exists. Recommend deleting the route and nav entry for now.
- Shots: `{es,en}-mapa-aportar-*.png`, `seg/es_mapa_aportar-*`.

**Comercio `/comercio/`.** A composer for copy-only listings (Comercio work comes after Corte 0). Cut the kicker, «anuncios públicos aún no…», «Borrador local» ×2, the process hints, «Opcional», «Datos declarados», «Precio NPC…», «…sin catálogo», the duplicate textarea, the Ditto placeholder and the decorative tiles. Keep intent, asset, fields, price, preview, Copy and a shorter RMT notice. Codex Tooltip version: the preview becomes `UnitTooltip` (Corte 0 gallery); selections turn blue; one gold CTA («Copiar anuncio»); «Entrenamiento» and «Memory Slots» labels.
- Shots: `{es,en}-comercio-*.png`, `seg/es_comercio-*`, `states/{es,en}-comercio-{ditto,kks,item}-{desktop,mobile}.png`.

**Cambios `/cambios/`.** Empty. Cut the page from nav, sitemap and index until there are entries. If kept, one line. No game layer.
- Shots: `{es,en}-cambios-*.png`, `seg/es_cambios-*`.

**Buscar `/buscar/?q=`.** Search results, currently broken (the query is ignored). Cut «en el Codex», the intro, the hidden eyebrow, repeated «POKÉMON» kickers, raw `normal`/`shiny`/`city` meta and the "list everything" default. Keep the box pre-filled with the query and a result count in sentence case. Codex Tooltip version: shell rows with a mini sprite slot and a type chip, grouped by collection.
- Shots: `{es,en}-buscar-{q,empty,noresult}-{desktop,mobile}.png`, `seg/es_buscar_q_charizard-*`.

**404.** Missing; players get Astro's default English page. Add a bilingual 404 inside `AppLayout` with the search box and a link home.
- Shots: `{es,en}-notfound-{desktop,mobile}.png`.