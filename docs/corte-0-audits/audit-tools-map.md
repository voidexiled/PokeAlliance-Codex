# Corte 0 audit: tools and map (Codex Tooltip, content slop, migration)

I changed nothing in the repo. Scratch output is in `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/corte0/`:
- `migration-inventory.txt`: every hard-coded font-size, radius, shadow, font-family, tracking, case, weight, height, motion and color in guild/map rules, as `g:`/`w:` line lists. `*` marks a rule whose class is dead.
- `dead-classes.txt` and `dead-class-lines.txt`: the 64 guild/map CSS classes nothing uses, with every line where each is defined.
- `css-hardcoded.json`: the raw extraction.
- `extract-css.js`, `agg.js`, `shadow.js`: the scripts that produced them.
- `guild-fixture.json`: a copy of the test fixture used for the render check.

I also checked the existing `dist/` build with a temporary read-only local server, loading the synthetic test fixture for Guild. That build is from Sep 17 18:59, and `wiki-reference.css` changed at 20:06, so the computed sizes quoted below are approximate.

Abbreviations used below:

| Short | Path |
|---|---|
| **TI** | `src/pages/[locale]/herramientas/index.astro` |
| **GA** | `src/pages/[locale]/herramientas/guild.astro` |
| **GRT** | `src/components/tools/GuildRankingTool.tsx` |
| **GPP** | `src/components/tools/GuildPersistencePanel.tsx` |
| **GWC** | `src/components/tools/guild/GuildWorkspaceChrome.tsx` |
| **IMG** | `src/lib/tools/guild-ranking-image.ts` |
| **MI** | `src/pages/[locale]/mapa/index.astro` |
| **MA** | `src/pages/[locale]/mapa/aportar.astro` |
| **ME** | `src/components/map/MapExplorer.tsx` |
| **g:** | `src/styles/global.css` |
| **w:** | `src/styles/wiki-reference.css` |

Where both locales are cited, the format is "es line / en line".

---

## 1. Inventory

| Route / component | Purpose |
|---|---|
| `/{es,en}/herramientas/` (TI) | Tools landing page: search panel, 3 tool rows (map, Pokémon compare, guild) and a "planned" roadmap list. |
| `/{es,en}/herramientas/guild/` (GA) | Page shell (breadcrumbs, h1, intro) that mounts `GuildRankingTool client:load`. |
| `GuildRankingTool` (GRT, 2218 lines) | Imports daily guild-member JSON exports into localStorage (max 120). Computes the weekly ranking (dailies × level value + contribution) and goals. It has three tabs (Ranking / Activity / History), dialogs (Import, JSON preview), sheets (Goals & calculation, Account, Member) and exports (WhatsApp, Discord, PNG). |
| `GuildWorkspaceChrome` (GWC) | Presentational pieces: `GuildWorkspaceHeader` (eyebrow, guild name, member badge, context dl, actions), `GuildStatusStrip` (All / On target / Below / No target filter) and `GuildPagination`. |
| `GuildPersistencePanel` (GPP) | Supabase email/password sign-in and sign-up, guild select/create, and "save this export" through an RPC. Merges remote history back into the tool. |
| `guild-ranking-image.ts` (IMG) | Draws the 1520 px-wide PNG ranking on a canvas: Verdana, an 11-hex palette and uppercase labels. |
| `/{es,en}/mapa/` (MI) | "Client map" page with eyebrow, intro, contribute link and `MapExplorer`. |
| `MapExplorer` (ME) | Map of 119 client minimap flags across floors 1,3,4,5,6,7,8,9, drawn over the OTMM floor PNG. Floor tabs, text filter, category tabs, legend toggles, pan/zoom, cursor readout, details panel and a pipeline disclaimer. |
| `/{es,en}/mapa/aportar/` (MA) | Documents a map-contribution format (fields, review-state enums). **There is no way to submit anything.** It is also linked from the main nav (`AppLayout.astro:73-76`). |
| Related CSS | Guild/map rules are spread over 5 blocks: `g:685-1130` (map, components layer), `g:1395-2206` and `g:2318-2431` (guild, components layer), `g:3243-3364` (guild, `legacy-wiki` layer), `w:1330-1575`, `w:3203-4162` ("Guild operational workspace"), `w:4163-5419` ("dense operations") and `w:5420-5496` ("Final Guild layout reset"). That is **three stacked guild skins in `wiki-reference.css`, plus two more in `global.css`**. |
| Out of scope but touched | `herramientas/pokemon.astro` and `PokemonExplorer.tsx` (listed on TI). `lib/supabase/guilds.ts` (error strings shown by GPP). `lib/map/client-map.ts:57` (marker-label fallback). `ui/sheet.tsx:68` and `ui/dialog.tsx:63` (English "Close"). `AppLayout.astro:73-76` (nav link to MA). |

---

## 2. Content slop

Action key: **DEL** = delete; **REP** = replace with the given es / en text; **KEEP** = keep, with the reason.

### 2a. Tools index (TI)

| file:line | loc | Current text | Problem | Action |
|---|---|---|---|---|
| TI:16-17 / 47-48 | both | meta description "Utilidades integradas en la wiki para consultar y organizar…" | generic filler | **REP** "Mapa, comparador de Pokémon, ranking de guild y búsqueda de PokeAlliance." / "Map, Pokémon comparison, guild ranking and search for PokeAlliance." |
| TI:86 | both | eyebrow "Sección del Codex" / "Codex section" | kicker; already hidden by `w:512-514`, so dead markup | **DEL** |
| TI:18-19 / 49-50, rendered at :88 | both | "Las herramientas forman parte del Codex. Cada una se habilitará cuando sus datos y límites estén suficientemente revisados." | project-process meta | **DEL** |
| TI:20 / 51, rendered at :93 | both | h2 "Disponible" / "Available" | once the planned section is gone, this heading only restates that listed tools exist | **DEL** |
| TI:23-24 / 54 | both | "Encuentra Pokémon, movimientos, objetos, misiones y otros registros publicados." | "registros publicados" is pipeline jargon | **REP** "Busca Pokémon, movimientos, objetos y misiones." / "Search Pokémon, moves, items and quests." |
| TI:25 / 55 | both | "Mapa interactivo" / "Interactive map" | the same tool is called "Mapa" (nav), "Mapa del cliente" (h1) and "Mapa" (`<title>`) | **REP** "Mapa" / "Map" |
| TI:26-27 / 56 | both | "…marcadores del cliente y observaciones comunitarias revisadas." | **false**: no community observations exist, and MA cannot receive them. "cliente" is dev jargon. | **REP** "Pokémon Centers, Poke Marts y pescadores por piso, con coordenadas." / "Pokémon Centers, Poke Marts and fishermen by floor, with coordinates." |
| TI:28 / 57, rendered at :108 | both | status badge "Preview disponible" / "Preview available" | process/status text; badge adds nothing | **DEL** |
| TI:29 / 58 | both | "Comparar Pokémon y tiers" | the page h1 and nav say "Comparar Pokémon" | **REP** "Comparar Pokémon" / "Compare Pokémon" |
| TI:30-31 / 59-60 | both | "…filtra el roster público por tier, función y elementos." | "roster público" is jargon | **REP** "Compara variantes y filtra por tier, función y elemento." / "Compare variants and filter by tier, role and element." |
| TI:32 / 61, rendered at :113 | both | badge "Disponible" | the badge adds nothing | **DEL** |
| TI:34-35 / 63-64 | both | "Carga el JSON del cliente, calcula el ritmo semanal y exporta texto e imagen con la contribución." | describes the implementation, not the player benefit | **REP** "Dailies, contribución y metas semanales de tu guild, con resúmenes para WhatsApp y Discord." / "Your guild's weekly dailies, contribution and goals, with summaries for WhatsApp and Discord." |
| TI:36 / 65, rendered at :118 | both | badge "Disponible en local" / "Available locally" | dev/status meta | **DEL** |
| TI:21 / 52, and :123-144 | both | whole "Siguiente en la hoja de ruta" section; each row repeats `{copy.planned}` as a badge (:131, :136, :141) | roadmap meta and a duplicated label. The rows look clickable but are not links. "Rotaciones y equipos" clashes with the existing `/rotaciones` page. | **DEL** the whole section and strings :37-43 / :66-71 |

### 2b. Guild page (GA)

| file:line | loc | Current text | Problem | Action |
|---|---|---|---|---|
| GA:21 / 30, rendered at :48 | both | eyebrow "Herramientas / Guild" | kicker duplicating the breadcrumbs; hidden by `w:512` | **DEL** |
| GA:22-23 / 31, rendered at :50 | both | "Importa cortes diarios; el ranking ajusta las metas a los días habilitados de cada miembro." | intro/tagline; the empty state and Goals sheet already cover it | **DEL** |
| GA:17-18 / 27 | both | meta description | fine | **KEEP**: this is the SEO description |

### 2c. GuildRankingTool (GRT): copy dictionary

| file:line (es / en) | Current text | Problem | Action |
|---|---|---|---|
| 196-199 / 374-377 | `eyebrow`, `title`, `intro` ("Herramienta de comunidad"…) | dead strings, never used | **DEL** |
| 201-202 / 379-380 | "Importa uno o varios días. Cada fecha se registra al instante y permanece guardada en este navegador." | wordy | **REP** "Puedes elegir varios días a la vez. Se guardan en este navegador." / "You can pick several days at once. They're saved in this browser." |
| 203 / 381 | "Seleccionar JSON(s)" / "Choose JSON file(s)" | the "(s)" is sloppy | **REP** "Elegir archivos" / "Choose files" |
| 205 / 383 | placeholder `{ "members": [...], "guild": "..." }` | developer-facing schema | **DEL** |
| 206 / 384 | "Cargar datos" / "Load data" | inconsistent with the "Importar" trigger | **REP** "Importar" / "Import" |
| 207 / 385 | `clear` | unused; :1816 hard-codes a duplicate "Limpiar" | use `strings.clear` at :1816 |
| 209-212, 214-215, 221-222, 224, 228, 233, 246-248, 250, 252-255, 258-260, 263-264, 266-268, 272-273, 288, 292-293, 303-315, 319-330, 332-342, 344, 363 (en mirrors 387-541) | 66 unused keys (full list in section 3, item 9) | dead copy | **DEL** |
| 219 / 397 | "Marcar para revisar" | fine | **KEEP** |
| 229-230 / 407-408 | "El total debe coincidir con las dailies de este intervalo. El JSON no conserva la hora de cada task, por eso los cambios de nivel son estimaciones." | the second sentence is pipeline meta; the first duplicates the "Dailies asignadas n / n" counter | **REP** "Reparte las dailies del día entre las dificultades; la suma debe igualar el total." / "Split the day's dailies across difficulties; they must add up to the total." |
| 234 / 412 | "Volver a automático", also reused as a success notice at :1311 | a button label misused as a confirmation | keep the button; notice **REP** "Desglose automático restaurado." / "Automatic breakdown restored." |
| 241 / 419 | "Contribución (dinero)" | "(dinero)" is noise. Terminology drifts between Contribución and Donación (:267, :360, IMG:85). | **REP** "Contribución" / "Contribution" everywhere; drop "Donación/Donation" |
| 244 / 422 | "Vacío = desactivada" / "Empty = disabled" | developer notation | **REP** "Deja un campo vacío para no evaluar esa meta." / "Leave a field empty to skip that goal." |
| 245 / 423 | `derivedContribution` (unused) | the block it should label, :2004-2026, is unlabeled | **REP** and use it as the label: "Contribución diaria necesaria por nivel" / "Daily contribution needed by level" |
| 249 / 427 | "Zona horaria del export" | anglicism | **REP** "Zona horaria de los archivos" / "File time zone" |
| 251 / 429 | "Server Save BR" / "BR Server Save" | :1441 shows the same zone as "America/Sao_Paulo" | **REP** "Server Save (Brasil)" / "Server Save (Brazil)" |
| 256 / 434 | "Cálculo añadido al historial." | process wording | **REP** "Corte del {fecha} añadido." / "Added the {date} snapshot." |
| 257 / 435 | "Cálculo actualizado. Se recalcularon los deltas de la semana." | dev meta ("deltas") | **REP** "Corte del {fecha} actualizado." / "Updated the {date} snapshot." |
| 262 / 440 | "Día de control" / "Control day" | jargon | **REP** "Día" / "Day" |
| 265 / 443 | `members`, used only by the header badge | the badge duplicates the "Todos N" filter count | **DEL** with the badge |
| 269 / 447 | "Premium" as a status badge | reads like a premium *account* | **REP** "Meta premium" / "Premium goal" |
| 270 / 448 | "Clasificación" / "Ranking", used 3 times (eyebrow :1341, tab :1433, h3 :1467) | the same label three times | keep it on the tab only |
| 289 / 467 | "miembros visibles" (:1468-1471 "3 / 3 miembros visibles") | duplicates the pagination and filter counts | **DEL** |
| 291 / 469 | "Exportar datos" (sr-only on an icon-only Download trigger) | the icon suggests a direct download, but it opens copy actions | **REP** with a visible label "Compartir" / "Share" |
| 297 / 475 | "Resumen en español copiado para WhatsApp." | "en español" is noise | **REP** "Copiado para WhatsApp." / "Copied for WhatsApp." |
| 298 / 476 | "Anuncio Markdown copiado para Discord. Se separa en bloques si hace falta." | dev wording ("Markdown"); unconditional | **REP**: 1 block: "Copiado para Discord." / "Copied for Discord."; more than 1: "Copiado en {n} bloques: pégalos como mensajes separados." / "Copied as {n} blocks: paste them as separate messages." |
| 299 / 477 | "Imagen PNG generada con la contribución incluida." | process meta | **REP** "Imagen descargada." / "Image downloaded." |
| 300 / 478 | "Todavía no hay una guild cargada" | acceptable empty-state title | **KEEP** |
| 301 / 479 | "Selecciona el JSON exportado por el cliente o pégalo en el campo anterior." | **wrong**: there is no field above the empty state (the paste field is inside the dialog) | **REP** "Elige uno o varios archivos JSON de miembros exportados desde el cliente del juego." / "Choose one or more guild-member JSON files exported from the game client." The owner should add the in-game export steps, which are still an open question (`docs/GUILD_SYSTEM_RESEARCH.md:82`). |
| 302 / 480 | "Historial de snapshots" (h3 in the History tab) | duplicates the tab label; "snapshots" is an anglicism in es | **REP** "Cortes guardados" / "Saved snapshots" |
| 316 / 494 | "Base de semana" / "Week baseline" | jargon | **REP** "Inicio de semana" / "Week start" |
| 317 / 495 | "Delta calculado" / "Calculated delta" | dev jargon, and the badge sits on almost every row | **DEL** (no badge for normal days) |
| 318 / 496 | "Disminución detectada" | fine idea, vague wording | **REP** "Total menor que el anterior" / "Lower than previous total" |
| 343 / 521 | h3 "Actividad de miembros" | duplicates the "Actividad" tab | **DEL** (or make it sr-only) |
| 350 / 528 | "No hay movimientos de miembros en los snapshots de esta semana." | filler plus an anglicism | **REP** "Sin altas ni bajas esta semana." / "No joins or departures this week." |
| 351-353 / 529-531 | "Alta observada / Reingreso observado / Baja observada" | "observada" is process text | **REP** "Ingresó / Volvió / Salió" and "Joined / Returned / Left" |
| 354 / 532 | "Detectado al comparar snapshots" | process meta | **REP** "Entre {a} y {b}" / "Between {a} and {b}" |
| 355-356 / 533-534 (rendered :1670) | "Los miembros del primer snapshot se consideran anteriores al histórico. No se inventa su fecha de ingreso…" | methodology disclaimer shown on every visit | **DEL** |
| 357 / 535 | "Progreso y acceso" | vague | **REP** "Esta semana" / "This week" |
| 358 / 536 | "Sin cambio de nivel" | filler default state | **DEL** (show only "+N niveles") |
| 360 / 538 | "Donación desde" | terminology drift | **REP** "Contribución desde" / "Contribution from" |
| 361 / 539 | "Dailies y donación habilitadas" | filler default state | **DEL** |
| 362 / 540 | "Miembro previo al histórico" | process meta | **DEL** |
| 365 / 543 | "El contenido no es un JSON válido." | fine | **KEEP** (in en, prefer "This file isn't valid JSON.") |
| 366-367 / 544-545 | "El JSON debe contener un objeto principal." / "…una lista members válida." | developer-facing (schema key names) | **REP** both with "El archivo no es una exportación de guild válida." / "This file isn't a valid guild export." |
| 370 / 548 | "…mismo nombre normalizado." | "normalizado" is dev wording | **REP** "Hay dos miembros con el mismo nombre." / "Two members share the same name." |

### 2d. GuildRankingTool (GRT): inline JSX text

| file:line | loc | Current text | Problem | Action |
|---|---|---|---|---|
| 651 | both | "Historial del navegador" / "Browser history" (fileName) | leaks into the JSON dialog and the account hint | **REP** with "Corte del {fecha}" / "{date} snapshot" |
| 690-691 | both | "El navegador no pudo guardar más historial local." | needed, but gives no action | **REP** "No hay espacio para guardar más historial. Inicia sesión para respaldarlo." / "No space to save more history. Sign in to back it up." |
| 1175-1176 | both | notice "Viendo el registro del …" | duplicates the historical banner at :1413-1415 | **DEL** |
| 1336 | both | "Cargando historial…" | needed | **KEEP** |
| 1341 via GWC:32 | both | eyebrow "Clasificación" over the guild name | kicker and a triplicated label | **DEL** |
| 1343 via GWC:35 | both | badge "3 miembros" | badge adds nothing | **DEL** |
| 1350-1351 | both | context "Corte: 10/09/2026" | needed | **KEEP** |
| 1354-1355 | both | context "Cobertura: 1 registro · 1 semana · 1 mes" | meta; duplicates :1680 | **DEL** |
| 1358-1366 | both | context "Guardado: Navegador (· Sin conexión)" | storage meta; offline state is already in the account sheet (:1843-1846) | **DEL** |
| 1414-1415 | both | "Vista histórica · {fecha}" | needed | **KEEP** |
| 1418 | en | "Return to latest" | incomplete | **REP** en "Back to latest snapshot" (es stays) |
| 1441 | both | `{ranking.week.sourceTimeZone}` shows "America/Sao_Paulo" | developer-facing IANA ID | **DEL** |
| 1467 | both | h3 "Clasificación" | duplicate of the tab | make it sr-only |
| 1534, 2072 | both | "Lv." hard-coded | not localized | `levelShort` "Nv." / "Lv." (owner may keep "Lv." if it matches the game) |
| 1541 | both | "pts." hard-coded | not localized | move into `strings` |
| 1611-1613 | both | "Cambios observados en los cortes de la semana." | intro restating the title | **DEL** |
| 1680 | both | "1 registro · 1 semana · 1 mes" | coverage meta | **REP** "{n} cortes" / "{n} snapshots" |
| 1686-1688 | both | "{n} días sin corte entre los registros guardados." | a genuine data-gap warning | **KEEP** |
| 1720 | both | literal "dailies" | hard-coded | use `strings.dailies` |
| 1736 | both | "Ver JSON" / "View JSON" | developer-facing raw dump | **DEL** (see section 3) |
| 1743 | both | "Aún no hay cortes guardados." | unreachable: the History tab only exists once a snapshot exists | **DEL** |
| 1784 | both | "Uno o varios archivos JSON" | duplicates the button text | **DEL** (show only the selected file name) |
| 1816 | both | "Limpiar" / "Clear" | hard-coded duplicate | use `strings.clear` |
| 1828-1829 | both | "JSON · {fecha}", "JSON local" | dev dialog; "JSON local" is Spanish in en | **DEL** with the dialog |
| 1847-1849 | both | "Sincroniza el historial con tu guild." | duplicates GPP:31-32 | **REP** (signed out only) "Inicia sesión para guardar el historial de tu guild y abrirlo en otros dispositivos." / "Sign in to save your guild history and open it on other devices." (signed in: no description) |
| 1844-1846 | both | "Sin conexión. El historial local sigue disponible." | a genuinely needed notice | **KEEP** |
| 1857 | both | fallback `'manual-paste'` shown at GPP:386 | a developer literal shown to users | **REP** with the snapshot date label |
| 1876-1878 | both | "Metas prorrateadas según los días habilitados." | useful, but jargon | **REP** "Las metas se ajustan a los días en que cada miembro pudo participar." / "Goals are prorated to the days each member could take part." |
| 1955-1957 vs 2014-2017 | both | "350–∞" vs "350+" | inconsistent | **REP** "350+" |
| 1969 | both | `<small>Puntos por daily</small>` repeated 3 times | duplicated label | one column header |
| 2036-2037 | both | "{n} campo inválido" | plural bug | **REP** "{n} campo(s)…" with proper plurals: "1 campo inválido / 2 campos inválidos", "1 invalid field / 2 invalid fields" |
| 2042-2044 | both | "Sin cambios" / "No changes" | filler (and wrong, see section 3) | **DEL** |
| 2097 | both | h3 "Evaluación" | vague | **REP** "Meta semanal" / "Weekly goal" |
| 2206-2210 | both | "Este corte no tiene un intervalo de dailies para corregir." | dev wording | **REP** "Este corte no tiene dailies para desglosar." / "This snapshot has no dailies to split." |

### 2e. GuildPersistencePanel (GPP): auth UI copy

| file:line (es / en) | Current text | Problem | Action |
|---|---|---|---|
| 29 / 64, rendered at :313 | eyebrow "Cuenta y archivo" | kicker; the whole heading block :311-319 is `display:none` (`w:4022-4024`) | **DEL** :311-319 |
| 30 / 65, rendered at :314 | h2 "Cuenta y respaldo" | duplicate of the SheetTitle (GRT:1841) and hidden | **DEL** |
| rendered at :317 | status "Supabase" / "Local" / "Sesión activa" | vendor/dev badge | **DEL** |
| 31-32 / 66-67, rendered at :321 | "Inicia sesión para guardar este export… El servidor conserva un export por fecha de Server Save y reemplaza…" | server-behaviour meta; shown even when signed in | **DEL** (replaced by the GRT:1847 text above) |
| 33 / 68 | "La conexión con Supabase todavía no está configurada en este entorno." | developer-facing | **REP** "La sincronización no está disponible ahora. Tu historial sigue guardado en este navegador." / "Sync is unavailable right now. Your history is still saved in this browser." |
| 37-38 / 72-73, rendered at :392-423 | tabs "Acceso / Registro", "Access / Register" | vague; a fake tablist (both tabs control the same form) | **REP** with a mode toggle. Primary button "Iniciar sesión" / "Sign in" plus a text button "¿No tienes cuenta? Crear una" / "No account? Create one". In sign-up mode: "Crear cuenta" / "Create account" plus "¿Ya tienes cuenta? Iniciar sesión" / "Have an account? Sign in". |
| (missing) | no password rule shown; `config.toml:181` requires 6 characters | a needed hint is missing | **ADD** (sign-up only) "Mínimo 6 caracteres." / "At least 6 characters." plus `minLength={6}` |
| 47 / 82 | "Crear y seleccionar" | wordy | **REP** "Crear guild" / "Create guild" |
| 271 | message "Crear guild: {name}" | a button label used as a success message | **REP** "Guild creada: {nombre}" / "Guild created: {name}" |
| 48 / 83 | "Guardar este export" | anglicism, no date | **REP** "Guardar corte del {fecha}" / "Save {date} snapshot" |
| 49 / 84 | noExport | unreachable (the sheet only opens once a payload is loaded) | **DEL** |
| 50 / 85 | "Crea o selecciona una guild para guardar el export." | fine intent | **REP** "Elige o crea una guild para guardar." / "Choose or create a guild to save." |
| 51-53 / 86-88, :302-306 | "Export guardado: 2026-09-10. El export de ese día fue reemplazado y quedó registrado en el historial." | raw ISO date, verbose | **REP** "Corte del 10/09/2026 guardado." plus, if replaced, " Se reemplazó el anterior." / "Saved the 10/09/2026 snapshot." plus " The previous one was replaced." |
| 54-55 / 89-90 | "…Si Supabase solicita confirmación, revisa tu correo…" | vendor name | **REP** "Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión." / "Account created. Check your email to confirm it before signing in." |
| 363 | placeholder "Family One" | invented or real guild name as an example | **DEL** |
| 371, 383, 452 | busy label "…" | the screen reader just hears "…" | **REP** "Creando…/Guardando…/Entrando…" and "Creating…/Saving…/Signing in…" |
| 386 | hint shows `sourceLocator` (a file name, "manual-paste" or "Historial del navegador") | developer-facing | **REP** "Corte del {fecha}" / "{date} snapshot" |
| **Raw English Supabase errors:** 140, 160 (PostgREST `error.message` from `guilds.ts:42,59,77`); 173 (`sessionError.message`); 227 (auth, e.g. "Invalid login credentials", "User already registered", "Password should be at least 6 characters", "Email rate limit exceeded"); 240 (signOut); 265 and 298 (RPC `error.message` via `resultError`, `guilds.ts:134,181`) | shown verbatim in es and en | developer-facing | **REP** with a `mapSupabaseError(code)` helper that matches on `error.code`, never the message text. |
| `guilds.ts:150,158` | "El JSON necesita exportedAt…", "El valor de exportedAt no tiene un formato…" | Spanish-only, and dev-facing (key name) | **REP** "El archivo no tiene fecha de exportación." / "This file has no export date." |

Error mapping for the `mapSupabaseError(code)` helper:

| Error code | Spanish | English |
|---|---|---|
| `invalid_credentials` | "Correo o contraseña incorrectos." | "Wrong email or password." |
| `user_already_exists` | "Ya existe una cuenta con ese correo." | "An account with that email already exists." |
| `weak_password` | "La contraseña debe tener al menos 6 caracteres." | "Password must be at least 6 characters." |
| `email_not_confirmed` | "Confirma tu correo antes de iniciar sesión." | "Confirm your email before signing in." |
| `over_email_send_rate_limit`, `over_request_rate_limit` | "Demasiados intentos. Espera un momento." | "Too many attempts. Please wait a moment." |
| `42501`, `PGRST301` | "Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión." | "Your session expired or you lack permission. Sign in again." |
| `23505` (on create guild) | "Ya existe una guild con ese nombre." | "A guild with that name already exists." |
| network `TypeError` | "Sin conexión con el servidor." | "Can't reach the server." |
| anything else | existing `errors.generic` | existing `errors.generic` |

### 2f. Guild PNG (IMG)

| file:line | Current text | Problem | Action |
|---|---|---|---|
| 91 / 110 | footer "Alliance Codex · Ranking de guild · contribución separada de puntos" | methodology meta | **REP** "Alliance Codex · Ranking de guild" / "Alliance Codex · Guild ranking" |
| 137 | "Semana 2026-09-07 → 2026-09-13 · día 4/7 · zona America/Sao_Paulo" | raw ISO dates and an IANA ID; the UI uses DD/MM/YYYY | **REP** `Semana 07/09–13/09/2026 · Día 4/7` / `Week 07/09–13/09/2026 · Day 4/7` |
| 83-86 / 102-105, 215-231 | "META HOY, DAILIES, DONACIÓN, PREMIUM, NOMBRE, CARGO…" | uppercase labels; "DONACIÓN" drifts from the "CONTRIBUCIÓN" column | **REP** Title Case with a colon: "Meta hoy:", "Dailies:", "Contribución:", "Meta premium (semana):" and "Today's goal:", "Dailies:", "Contribution:", "Premium goal (week):" |
| 127 | fallback "Guild ranking" (English in es) | i18n | use a localized fallback |
| 153, 174 | "pts" hard-coded | i18n | localize |

### 2g. Map page (MI)

| file:line (es / en) | Current text | Problem | Action |
|---|---|---|---|
| 39 | `title="Mapa"` hard-coded, so en `<title>` is "Mapa · Alliance Codex" | i18n bug | `title={copy.title}` |
| 17 / 27 | h1 "Mapa del cliente" / "Client map" | "cliente" is dev jargon; the name differs from the nav | **REP** "Mapa" / "Map" |
| 18-19 / 28-29 | meta "Preview interactivo de coordenadas y marcadores observados en el cliente…" | process wording | **REP** "Mapa de PokeAlliance por pisos: Pokémon Centers, Poke Marts y pescadores con coordenadas." / "PokeAlliance map by floor: Pokémon Centers, Poke Marts and fishermen with coordinates." |
| 20 / 30, rendered at :52 | eyebrow "Herramientas / Mapa" | kicker; hidden | **DEL** |
| 21-22 / 31-32, rendered at :54 | "…Esta primera vista representa la capa observada del cliente; todavía no es un mapa semántico completo del mundo." | project/pipeline meta | **DEL** |
| 23-24 / 33-35, rendered at :55-58 | "Aportar al mapa · Formato para enviar observaciones sin publicarlas automáticamente. →" | process text, and it leads to a dead end | **DEL** until a submission channel exists. Then use "¿Falta un punto? Envía una corrección" / "Missing a spot? Send a correction". |
| 60 | `aria-label={copy.title}` on the section | duplicates the h1 | **DEL** (or use `aria-labelledby` on the h1) |

### 2h. MapExplorer (ME)

| file:line (es / en) | Current text | Problem | Action |
|---|---|---|---|
| 34 / 61 | placeholder "Pokémon Center, Poke Mart…" | **it breaks search**: the data says "Pokemon Center" and the filter (:125-131) does not strip accents, so typing the suggested term matches 0 of 119 markers | **REP** "Buscar marcador" / "Search markers", and make the filter accent-insensitive |
| 36 / 63, rendered at :443 | footer "Marcadores disponibles" / "Available markers" | duplicates :441 and the region label | **DEL** |
| 40-42 / 67-69, rendered at :483-486 | "Límite de este preview: La base visible es una miniatura derivada del snapshot OTMM del cliente. Los puntos provienen de Minimap.flags…" | developer/pipeline disclaimer | **DEL** |
| 44 / 71 | "Otro marcador del cliente" / "Other client flag" | dev jargon | **REP** "Otros" / "Other" |
| 45 / 72, rendered at :282 | "Capas" / "Layers" plus "Piso 7" (:283-285) | the floor duplicates the tabs and the details header | **REP** heading "Marcadores" / "Markers"; **DEL** the floor span |
| 46-47 / 73-74, rendered at :287-293 | row "Marcadores del cliente · N visibles" | dev jargon; duplicates the footer and the region label | **DEL** |
| 48 / 75 | `hidden` | unused string | **DEL** |
| 53 / 80, rendered at :437 | overlay "Arrastra el mapa para explorar" | a permanent hint; `cursor:grab` already signals it | **DEL** |
| 54 / 81, rendered at :330-332 | badge "Mapa base" | badge adds nothing | **DEL** in the loaded state |
| 55 / 82 | "Mapa base no disponible" | a needed notice, vague wording | **REP** "Sin imagen de mapa para este piso" / "No map image for this floor" |
| 347-352 | axis labels "x 1023–1840", "y …" | debug bounds | **DEL** (the cursor readout already gives coordinates) |
| 361 + 364-366 | `title` duplicates the sr-only text | double announcement | keep the sr-only text; the Corte 1 peek replaces the `title` |
| 449-453 | header shows "Coordenadas" plus "Piso 7" | duplicated floor label | **DEL** the floor span |
| 468-475 | `dt` "icon", "flagId" (English code keys in es) | developer-facing | **DEL** (update `smoke.spec.ts:492`) |
| 457-466 | x / y / z rows | needed | **KEEP**: collapse into one "Coordenadas: 1234, 567, 7" row in mono, with a copy button |
| 478 | "Selecciona un marcador para ver sus coordenadas." | a useful instruction | **KEEP** |
| 17, 88-90, 115, 273, 312 | "Pokemon Center / Poke Mart / Fisherman" untranslated in es | game names | **KEEP** as the in-game strings (the owner confirms whether the es client says "Pescador") |
| `client-map.ts:57` | "Marcador sin etiqueta" in both locales | i18n | localize (the same as `unlabeled`) |

### 2i. Contribute page (MA)

The page documents a submission format but offers no way to submit. Recommendation: **unpublish** it (route, `AppLayout.astro:73-76` nav entry and the MI:55-58 link) until the owner picks a channel (form, Discord or email). If it stays, keep only the rows marked KEEP below.

| file:line (es / en) | Current text | Problem | Action |
|---|---|---|---|
| 16-17 / 59 | meta "Formato para enviar observaciones… para revisión manual." | process | **REP** "Cómo enviar un punto o corrección del mapa de PokeAlliance." / "How to send a PokeAlliance map spot or correction." |
| 18 / 60, rendered at :119 | eyebrow | kicker, hidden | **DEL** |
| 19-20 / 61 | intro | acceptable | **KEEP** |
| 21-26 / 62-67 | "Qué se puede aportar" list | useful | **KEEP** |
| 32 / 73 | "spawn_area, hunt_entrance, npc, quest_point, travel_point u otro" | developer enum values | **REP** "Aparición, entrada de hunt, NPC, punto de quest, viaje u otro" / "Spawn, hunt entrance, NPC, quest point, travel or other" |
| 39 / 83 | "Instante original en ISO; se mostrará localmente usando Temporal." | developer-facing (Temporal API) | **REP** "Fecha y hora de la captura." / "Date and time of the capture." |
| 41-49 / 85-93, rendered at :156-179 | review-states table (`pending_review`, `approved`…) | internal workflow enums | **DEL** |
| 50-52 / 94-96, rendered at :181-185 | "Límite actual: Esta página documenta el formato; todavía no existe un envío automático ni una cuenta de colaborador…" | project-status meta | **DEL** |
| 53-54 / 97-98 | privacy notice | genuinely needed once a channel exists | **KEEP** |
| 182 | eyebrow "Límite actual" | kicker | **DEL** |
| 195-201 | TOC "Resumen" / "Summary" with 4 links | chrome on a short page, and a mislabelled TOC | **DEL** |

---

## 3. Fake, broken and dead UI

1. **The Save/Cancel footer doesn't cover the Calculation tab** (GRT:1928-2002 vs :2032-2054).
   - The policy select (:1932-1941), the tier points inputs (:1959-1968) and the time-zone select (:1975-2001) write straight to state and localStorage.
   - The footer still reads "Sin cambios" (it only checks `goalsDirty`, :723), and Cancel (`closeGoalsSheet`, :1025-1028) does not revert them.
   - **Fix:** put the calculation settings into the draft, or move them out of the sheet as auto-saved controls with a "Guardado" confirmation. Hide the footer on that tab.
2. **Duplicate time-zone select** in the Import dialog (GRT:1795-1807). It only calls `setSourceTimeZone`, while the Calculation-tab copy (:1977-1994) also re-derives every stored snapshot, so the two paths leave the data inconsistent. **Fix:** delete it from the dialog.
3. **Ellipsis row button** (GRT:1570-1581). It opens the same sheet as the member-name button (:1527-1536). The "more" icon promises a menu that doesn't exist, and at 28 px it is too small. **Fix:** delete the column and use the name, or the whole row, with a ChevronRight.
4. **"Ver JSON"** (GRT:1727-1737, dialog :1825-1833) is a developer raw dump. It also calls `selectSnapshot`, which silently switches the ranking context and posts a notice. **Fix:** delete it; later, offer "Descargar archivo" if it is needed.
5. **Unreachable states:** GRT:1743 (History empty), GPP:49/:84/:386 (`noExport`). **Fix:** delete them.
6. **Dead markup hidden by CSS:**
   - page-header eyebrows TI:86, GA:48, MI:52, MA:119 (`w:512-514 display:none`);
   - the GPP heading block :311-319 (`w:4022-4024`).
   - **Fix:** delete them.
7. **Conflicting CSS for the premium badge.** `.guild-goal-state[data-band=premium]` is gold at `w:3551-3554` and blue at `w:4841-4843`. It renders blue text (#93c5fd) on a gold-tinted border. **Fix:** one rule, blue-hi plus the text "Meta premium".
8. **Stacked skins:**
   - 864 guild/map declarations in `global.css`, of which 327 are shadowed by the same selector and property in unlayered `wiki-reference.css`.
   - 78 selectors are defined 3 or more times: `.guild-settings-panel` 8×, `.guild-import-panel` 7×, `.guild-difficulty-input input` 6×, `.guild-primary-button` 5× (`g:1507,1555; w:1511,4367,4392`) and so on.
   - `g:3243-3364` sits in `@layer legacy-wiki`.
   - **Fix:** delete everything except one skin, rebuilt on the new tokens.
9. **Dead strings and classes:**
   - 66 unused GRT copy keys: es lines 196-199, 207, 209, 211-212, 214, 221-222, 224, 228, 233, 245-246, 248, 250, 252-255, 258-260, 263-264, 266-268, 272-273, 288, 292, 303, 305-315, 319-330, 332-342, 344, 363, mirrored in en.
   - 64 CSS classes that nothing uses (`dead-classes.txt`, lines in `dead-class-lines.txt`), including `map-source-note` (`g:1102-1115`, `w:1553`) and all of `guild-analytics/calculation/coverage/export/history-panel/import-panel/lifecycle/period/settings/summary-*`.
10. **TI planned rows** (:128-142) are styled `.wiki-data-row` exactly like the link rows above, but they are inert `div`s. **Fix:** delete them.
11. **MA is a dead end.** It says "submit", but there is no channel, and it is linked from the main nav (`AppLayout.astro:73-76`) and from MI:55-58. **Fix:** unpublish it, or wire it to a real channel.
12. **Map floor ↑/↓ buttons** (ME:411-436):
    - The aria-label says `Piso ${selectedFloor±1}`, but the button jumps to the next *existing* floor. From floor 1 it goes to 3, still labelled "Piso 2".
    - ↑ moves to a higher z. In OTClient convention, z 7 is ground level (it holds 65 of the 119 markers) and a higher z is *below* ground, so the arrow is likely inverted. The owner should verify.
    - **Fix:** label with the target floor, and orient the arrows to the game.
13. **Map legend counts ignore the floor** (ME:314 counts all floors). On floor 7 it shows "Pokemon Center 57, Poke Mart 44", but floor 7 has 29 and 25. **Fix:** count `flags.filter(z===selectedFloor)`, and hide categories with 0 markers.
14. **Two parallel filters for the same categories.** Category tabs (ME:258-276) and legend toggles (ME:294-317) filter the same data. Choosing tab "Fisherman" and hiding the Fisherman layer shows an empty map. **Fix:** keep one set of toggle chips.
15. **Map search can't find its own placeholder example** (ME:34 vs :125-131). **Fix:** accent-insensitive matching plus the new placeholder.
16. **Fake decoration on the map:** `.map-viewport::before` (a box) and `::after` (a dashed centre line) at `g:770-787` imitate a chart grid. The drag hint (:437), base badge (:330) and axis labels (:347-352) add chrome. **Fix:** delete them.
17. **Map selection looks exactly like focus and hover:** `w:1440-1447` gives all three the same outline in `--wiki-focus`, and hover also changes width and height, which shifts layout. **Fix:**
    - selection = a 2 px `--cx-blue-hi` ring plus the name in the details panel;
    - focus = a separate outline;
    - hover = `transform: scale()`.
18. **Guild sort buttons announce the arrow character.** The visible ↑/↓ is text inside the `<button>` (GRT:1314-1315, :1510), so screen readers read it on top of `aria-sort`. **Fix:** `aria-hidden` on the arrow.
19. **Some sort columns vanish on smaller screens.** Below 1200 px the Contribution and Last-access columns are hidden (`w:4108-4112`, `w:5483-5486`), so they can't be sorted there. **Fix:** a sort menu on mobile, or keep Contribution visible.
20. **PNG and UI disagree on band colours.** IMG:250 calls `getGuildMemberBand(member, ranking)` without `goalPacing`, while the UI passes it (GRT:915). A mid-week joiner can be red in the PNG and green on screen. **Fix:** pass the same pacing.

---

## 4. Game-layer candidates

| Surface | Why it qualifies | Priority |
|---|---|---|
| **Map marker details panel** (ME:447-480; CSS `g:1051-1100`, `w:1333`) | It shows a game location entity (Pokémon Center, Poke Mart, Fisherman NPC). The new layout:<br>- `GameCard`: Poppins 600 title with the marker name;<br>- `StatRow`s "Piso:" and "Coordenadas:" (gold label with colon, value in mono per the coordinates rule);<br>- the icon/flagId rows removed.<br>The data is static, one card, low risk. | **Corte 0 pilot (secondary)**. It exercises `GameCard` + `StatRow` + the mono-coords rule outside Comercio. The primary pilot should stay the Pokédex infobox (out of my scope). |
| **Guild PNG export** (IMG:60-303) | The palette, Verdana and 10 px uppercase labels must change anyway in Corte 0 (Verdana and the old tokens go away). It is a shareable guild artifact: Poppins 700 guild name, header metrics as `StatRow`s ("Meta hoy:" gold label, white value), table in Inter. | **Corte 0:** token and font swap (forced). **Later:** game-voice header. |
| **Map marker hover/focus peek** (the ME:361 native `title`) | A mini tooltip over the map (name plus "Coordenadas:"). The black text outline is allowed here because it sits over the map. | Later (needs the Popover/Tooltip primitive, WCAG 1.4.13 behaviour). |
| **Guild member sheet facts** (GRT:2078-2095, :2140-2204) | A player character: "Nivel:", "Cargo:", "Dailies:", "Contribución:", "Último acceso:" as `StatRow`s, and the difficulty split as rows. | Later, once `StatRow` exists; the sheet is form-heavy. |
| **Daily difficulty tiers** (GRT:1943-1972, :2004-2026) | Game data (Normal/Wildscape/Primal, level ranges, points) as a compact `StatRow` list. | Low / later. |
| **Explicitly not game layer** | Guild ranking table, status strip, Activity and History lists, tools index, MA. These stay **shell**: Inter tabular numbers, blue actions, success/danger/blue-hi with text for band states, **no gold**. | n/a |

---

## 5. Migration notes

The full per-line list is in `corte0/migration-inventory.txt`.

**Token aliasing.** Moving `var(--wiki-*)` onto the new tokens migrates about 90% of the live guild/map styles in `w:`.

| Current | New | Note |
|---|---|---|
| `--wiki-page-bg` | `--cx-canvas` | |
| `--wiki-surface` | `--cx-surface` | |
| `--wiki-surface-secondary`, `--wiki-hover` | `--cx-raised` | |
| `--wiki-line` | `--cx-line` | |
| `--wiki-line-strong` | `--cx-line-strong` | #373a41 fails 3:1; #646D7C passes |
| `--wiki-copy` | `--cx-copy` | numbers use `--cx-value` |
| `--wiki-copy-secondary` | `--cx-copy-2` | |
| `--wiki-copy-tertiary`, `-disabled`, `-quinary` | `--cx-muted` | quinary #61656c fails at 3.3:1 |
| `--wiki-link`, `--wiki-focus` | `--cx-blue-hi` | |
| `--wiki-success`, `--wiki-error` | `--cx-success`, `--cx-danger` | |
| `--wiki-brand-gold` | `--cx-gold` | game labels only |
| `--wiki-radius-control` (**8 px**) | 6 px | must change |
| `--wiki-radius-item` (6 px) | control radius | |
| `--wiki-radius-panel` (12 px) | shell panel | |

**Colours.** 143 distinct literals in guild/map rules; nearly all in `global.css`.

| Group | Examples (lines) | Target |
|---|---|---|
| Surfaces | #111419 (`g:726,756,828,930,1119,1894,1986,2025,2077`), #0e1115 (`1600,1720,1801`), #101419, #141920, #171a1f, #171c22, #171c24 | `--cx-recess` (inputs, empty slots) or `--cx-surface` |
| Surfaces | #1b222b, #1d252b, #20262e, #202831, #242930, #252b33, #2c343b | `--cx-card` / `--cx-raised` |
| Lines | #292e36 (16 uses, `g:695…2018`), #232830, #313b42, #303943, #3a464e, #424a53 | `--cx-line` |
| Control borders | #303640 (`g:706,724,1598,1652,1718,1764,1799,2151`), #39434f | `--cx-line-strong` |
| Text, light | about 17 near-whites (#dfe3e6, #eef0f2, #e6e9eb …) | `--cx-copy` (numbers `--cx-value`) |
| Text, mid | about 18 greys in #9aa2aa–#cbd2d8 | `--cx-copy-2` |
| Text, dim | about 35 greys in #596871–#969fa9 | `--cx-muted`. Several fail 4.5:1 today: #5f7780 `g:808`, #596871 `g:1489`, #5f6b77 `g:1570`, #697580 `g:1618,1729,1809` |
| Amber/gold used as **state or focus** (forbidden now) | #d79a55 (`g:830,932,936,1004`), `rgba(215,154,85,.12)` focus halo (`g:737,1619,1730,1810`), `rgba(224,161,91,…)` marker glows (`g:831,854,933`), #f1d0a1 (`853`), #e6b16f (`719,921`), #211a14/#b98149 (`717-718`), #d7a363 (`1755,1770,1827,1862`), #e0ad73/#4b3c2b/#a3794d/#2a2017/#f0c187/#8e633b/#bd8146/#d39a5d/#1a120b (`1514-1562`), #e0b37b (`1123`), #f0bd7d (`1005`), #e3b77e (`1874`) | Focus: 2 px `--cx-blue-hi` outline. Selected/active: blue ring plus icon/text. Primary buttons: `--cx-blue`. |
| Gold primary | Import button `w:3306-3310` (`--wiki-brand-gold` fill, #111318 text) | Shell action `--cx-blue` with ink #0B1A2B. Gold CTA is optional and at most one per screen; Guild is shell, so blue is recommended. |
| Status tints | #54c99a (`g:3302`), #73c5a1 (`1752`) | `--cx-success` |
| Status tints | #d77777/#e9a1a1/`rgba(215,119,119,.08)` (`1856-1858`) | `--cx-danger` |
| Status tints | teal #83b5bf/#a9d0d4/#9cc6cc (`1848-1851`, `2112`) | `--cx-blue-hi` or delete |
| Row backgrounds | #321d25/#17352f/#1c2b4b (`g:2087-2093`) | delete; keep the 2 px bar plus text (`w:4783-4795`) |
| Map domain (keep as domain tokens) | #3300cc (`g:765,798`), which matches the OT minimap water colour | `--map-water` (confirm) |
| Map categories | #82b7bf, #c0a36f, #927db9, #d77979, #6d747e (`g:833-848`, swatches `938-951`) | `--map-cat-center/-mart/-fisher/-other/-unlabeled`. Poke Mart's #c0a36f reads as gold, so give it a non-gold hue. Check 3:1 against water and land. |
| Legend overlay | `rgba(17,20,25,.84/.88/.9)` (`g:874,960,981`) + `backdrop-filter: blur(8px)` (`g:877`) | solid `--cx-surface` (no glass rule); `w:1365,1456` already force `none` |
| Misc | #fec84b (`w:1270`, status inferred) | copy-2 plus text |
| Misc | `color-mix` at `w:3454` (focus) | outline `--cx-blue-hi` |
| Misc | `color-mix` at `w:3496` (hover) | `--cx-raised` |
| Misc | `color-mix` at `w:3552/3557/3562` (badges) | new `StatusBadge` |

**Font sizes.** 34 distinct values. The rendered values in the build are 9–12 px: table head 9 px, cells 11 px, member subline 10 px, context `dt` 10 px, legend counts 9.3 px, axis 9.4 px, cursor readout 9 px, map footer 9.9 px.

| Current | Target |
|---|---|
| 0.5625, 0.56, 0.58, 0.59, 0.6, 0.61, 0.62, 0.625, 0.63, 0.64, 0.65, 0.66, 0.67, 0.68, 0.6875, 0.69, 0.7, 0.71rem | **12 px floor** |
| 0.72–0.78, 0.8, 0.82rem | **13 px** (table cells, stat rows) or 12 px (meta) |
| 0.875, 0.92rem | 14 px |
| 1, 1.05, 1.08rem | 16 px |
| 1.125, 1.18rem | 20 px |

The uppercase-plus-tracking labels go:

| Lines | Target |
|---|---|
| `g:1591-1592, 1786-1787, 1901-1902, 1993-1994, 2065-2066` | shell labels: 12 px sentence case `--cx-copy-2`, no tracking |
| `w:3284-3285` (context `dt`), `3480-3481` (table head), `3625`, `3893`, `4421-4423`, `4603-4604`, `4760-4761` | same |
| Any label on a game-layer card | 13 px Poppins 600, Title Case with a colon, gold |

**Fonts.**

| Where | Current | Target |
|---|---|---|
| Guild and map CSS: 33 × `var(--font-code)` | mono | Inter + `tabular-nums` everywhere, **except** map coordinates (`g:1017, 1088, 1093`, readout `ME:404`), which stay mono |
| `var(--font-body)` (`w:3256`, `w:4284`) | Verdana | Inter |
| IMG: 11 `context.font` lines (`126, 129, 189, 192, 201, 238, 270, 273, 276, 296, 301`) | Verdana | Poppins 700 for the title (`:126`), Inter for the rest |

For the PNG:
- `createGuildRankingPng` must become async and `await document.fonts.load(...)` for each face first, or the canvas silently falls back to another font.
- Canvas cannot switch on `tnum`, so ship a feature-frozen, tabular-by-default Inter subset for the canvas, or accept proportional digits in right-aligned cells.
- Raise the 10–11 px labels (`:189, 201, 238`) to 12 px.

**IMG palette** (`:60-72`):

| Key | Current | New |
|---|---|---|
| page | #0c0e12 | `--cx-canvas` #0F1318 |
| panel | #0c0e12 | `--cx-surface` #161B22 |
| panelHeader | #13161b | `--cx-raised` #262B32 |
| line | #22262f | #2E3540 |
| text | #f7f7f7 | #FEFEFE |
| secondary | #cecfd2 | #B6BCC6 |
| tertiary | #94979c | #8A919C |
| quinary | #61656c | #8A919C (fails today on the footer and the neutral band) |
| link | #93c5fd | #68C0FF |
| success | #47cd89 | #4ADE80 |
| error | #f97066 | #F87171 |

**Radii.**

| Current | Lines | Target |
|---|---|---|
| 3 px | `g:912, 959, 995, 1744` | 6 (controls) |
| 4 px | `g:707, 725, 980, 1515, 1719, 1800, 2131` | 6 (controls) |
| 5 px | `g:873, 1118, 1599` | 6 (controls) |
| 6 px | `g:755, 1653, 1765` | 6 or 8 by role |
| 8 px | `g:3253` | 8 |
| 999 px / 50% | markers and swatches `g:829, 931` | keep (domain dots) |
| `--wiki-radius-control` 8 px | 13 uses (`w:1465…4886`) | 6 |
| 12 / 8 | `IMG:121, 144, 235` | already on scale |
| bars | `w:1362, 1377, 4982, 5009` | 0 |

**Shadows.**

| Current | Lines | Target |
|---|---|---|
| focus/selection halos | `g:737, 1619, 1730, 1810, 831, 854, 933`; `w:3454` | 2 px outline `--cx-blue-hi`, no glow |
| legend shadow | `g:875` (`0 8px 24px rgb(0 0 0/.24)`) | e0 (inline legend) |
| floating map controls | none today | e2 if they float |
| band bars | `w:4784, 4788, 4792, 4906` (inset 2 px bars) | fine (or `border-inline-start: 2px`) |
| sheets and dialogs | | e2 |

**Control heights** (40 px minimum):

| Current | Lines |
|---|---|
| 28 px | map control buttons `g:992`; legend rows and chips `w:1382, 1392, 3871, 4316` |
| 32 px | `w:1527, 4677, 4717`; `Button` h-8 for Import/Metas/Cuenta/Export |
| 33–38 px | map category/floor buttons (rendered 29/33 px); inputs `g:723` 34, `g:1717, 1797` 34, `g:1511` 36, `g:1609` 38, `w:3438` 2.25rem |
| 28 px icon-sm | GRT:1573, GWC:107, GWC:120 |
| markers | 12–17 px (`g:826, 852`; `w:1432-1447`); add a 40 px hit area with `::after` |

**Weights.** 550/620/650 (`g:894, 1066, 1125, 1426, 1520, 1647, 1670, 1772, 1828, 1877, 1907, 1928, 1950, 1999, 2037, 2064, 2097, 2165, 2200`) → 400/500/600/700. Poppins is static 600/700 only.

**Motion.**

| Current | Target |
|---|---|
| `g:1521` (button transition) | d2 140 ms `cubic-bezier(.22,1,.36,1)` |
| `g:2078` (`background 160ms ease`) | same |
| Marker hover resize (`g:849-854`, `w:1440-1447`) | `transform: scale()` at d2 |
| Sheet/Dialog animations (`ui/sheet.tsx`, `ui/dialog.tsx`) | d4 260 ms, `motion-reduce:animate-none` |
| Map pan | recomputes `left/top` for about 65 markers and re-renders on every `pointermove` (ME:158-161, 188-221); move to one transformed layer |

**Bespoke classes to map onto components.**

| Current | Target |
|---|---|
| `.guild-primary-button`, `.guild-secondary-button` (raw `<button>` at GPP:329, 366, 377, 451), `.guild-file-button`, `.guild-table-action` | `ui/Button` (primary blue / outline / ghost, 40 px) |
| `.guild-field` (`input`/`select`/`textarea`) | `Field` + `Input` / `NativeSelect` / `Textarea` |
| `.guild-auth-mode-tabs` (fake tablist, GPP:392-423) | a text-button mode toggle |
| `.guild-status-strip` (`aria-pressed` single choice, GWC:59-71) | `RadioGroup` / `ToggleGroup type="single"` |
| `.guild-goal-state` + `Badge` | `StatusBadge` (success / danger / blue-hi + text) |
| `.guild-context-list`, `.guild-activity-summary`, `.guild-member-facts` | shell `StatList`; member facts later become `StatRow` |
| `.guild-pagination` | `Pagination` |
| `.guild-message`, `.guild-global-message`, `.guild-historical-banner` | `Notice`, plus `Toast` for transient copy/save feedback |
| `.guild-member-search`, `.map-query` | `Input type=search` |
| `.map-filter-button`, `.map-category-button`, `.map-legend-row` | one `FilterChip` / `ToggleGroup` |
| `.map-control-button` with text glyphs "−", "◎", "+", "↑", "↓" (ME:379, 388, 397, 422, 434) | icon `Button` with lucide Minus / Plus / LocateFixed / ChevronUp / ChevronDown |
| `.map-details-panel` | `GameCard` + `StatRow` |
| `.status-label` (TI, GPP), `.eyebrow`, `.map-base-badge`, `.map-boundary-note`, `.map-drag-hint`, `.map-axis-label` | delete |

**Tests to update deliberately** (`tests/e2e/smoke.spec.ts`):

| Lines | Depends on |
|---|---|
| 318, 393, 428, 463 | "registro(s)" in `guild-history-overview`, which is the header "Cobertura" slated for deletion |
| 492 | the `flagId` text |
| 495-497 | the Aportar link |
| 480, 489 | test IDs built from the dev category names (`map-layer-Other client flag`) |
| 380-384 | the tools index |

---

## 6. i18n parity and accessibility

**i18n**
- **Guild ranks are Portuguese** in the es and en UI and the PNG: `formatGuildRank` (`guild-ranking.ts:576-585`) is used at GRT:944 (so searching "miembro" finds nothing), GRT:1534, GRT:2072 and IMG:277. The exports already localize through `formatExportRank`; use it in the UI too.
- **Numbers are always pt-BR** (`formatGuildNumber` defaults to `'pt-BR'`, `guild-ranking.ts:565`). en shows "1.300", which reads like 1.3. Affected: GRT:1541, 1547, 1549, 1620, 1719, 1723, 2021, 2081, 2089, 2115-2116, 2126, 2189; IMG:132, 153, 158, 166, 174, 294, 297. **Fix:** pass `locale` everywhere.
- **Dates:** `formatSourceDate` returns DD/MM/YYYY in en (GRT:555-559, IMG:308-312), which is ambiguous for en readers. `lastLogin` is shown raw ("2026-09-09 23:10:00") at GRT:1260 and IMG:288. **Fix:** `Intl.DateTimeFormat(locale)`.
- es anglicisms and jargon: "export", "snapshots", "delta", "task" (GRT:230), "JSON(s)". Pick one term per concept: es "corte" / en "snapshot" for a day's data; "archivo JSON" only in the import dialog.
- Hard-coded single-locale strings:
  - "Lv." (GRT:1534, 2072), "pts." (GRT:1541; IMG:153, 174), "dailies" (GRT:1720);
  - "JSON local" (GRT:1829);
  - "Guild ranking" fallback (IMG:127);
  - `title="Mapa"` (MI:39);
  - "Marcador sin etiqueta" (`client-map.ts:57`);
  - Spanish-only errors (`guilds.ts:150, 158`);
  - raw English Supabase errors (see 2e);
  - English sr-only "Close" in `ui/sheet.tsx:68` and `ui/dialog.tsx:63`, which appears in all 3 guild sheets and both dialogs.
- `aria-label`s built from code keys: GRT:1964 and GRT:2168 produce "normal · Puntos por daily". Use the display names.

**Accessibility**
- Touch targets under 40 px: listed in section 5. Worst are the 12 px map markers and the 28 px icon buttons.
- **Focus:**
  - Guild inputs set `outline: 0` and rely on a 35% `--wiki-focus` box-shadow over a #61656c border (`w:3440-3455`), which is too weak. `--wiki-focus` #444ce7 is about 3.2:1.
  - Map selected, hover and focus look identical (`w:1440-1447`).
  - **Fix:** a 2 px `--cx-blue-hi` outline for focus; selection shown differently.
- **Live regions:**
  - GPP:458-459 error and message paragraphs are not live.
  - GRT:1401-1408 and :1411 insert `role=alert/status` nodes together with their content, which some screen readers skip.
  - ME:447 makes the whole details panel `aria-live`.
  - **Fix:** one persistent `role=status` element, updated with one-line messages.
- **Semantics:**
  - `aria-label` on role-less `div`s is ignored: ME:234 (floor tabs), ME:258 (category tabs), ME:280 (legend), ME:371 (controls, which are also mislabelled "Centrar mapa"), ME:411.
  - Floor and category buttons expose `data-active` but no `aria-pressed` or `aria-current` (ME:236-244, 260-275).
  - The status strip uses `aria-pressed` for a single choice (GWC:61-66); make it a radio group.
  - The GPP tablist has two tabs `aria-controls` the same panel (GPP:392-430).
  - MA:181-183 has `aria-labelledby` pointing at a body paragraph.
  - MA tables have no `th scope`.
  - MI:60 section label duplicates the h1.
- **Keyboard:** the map can only be panned with a pointer (ME:206-229). Add arrow-key pan on a focusable viewport, `+`/`−` keys and wheel zoom, and reduced-motion-safe panning.
- **Contrast:** `--wiki-copy-quinary` #61656c, used for the PNG footer and neutral band, is about 3.3:1. The map axis colour #5f7780 is below 4.5:1.
- The goal inputs have `aria-invalid` (GRT:1912-1914) but no error text tied to them via `aria-describedby`. The footer shows only a count.

---

## 7. Top 10 fixes in this scope, by impact

1. **Strip developer and pipeline text from the public map** (MI:17-24, 54-58; ME:40-42, 330-332, 347-352, 437, 443, 468-475, 483-486; `g:770-787`). Rename it "Mapa / Map" and fix the English `<title>` (MI:39). The map is a main-nav tool, and today most of its text describes the data pipeline, not the map.
2. **Guild account panel: stop showing raw Supabase errors and vendor/dev text.** Add `mapSupabaseError(code)` (GPP:140, 160, 173, 227, 240, 265, 298; `guilds.ts:150, 158`). Remove "Supabase" (GPP:33, 54-55, 317), `'manual-paste'` (GRT:1857 → GPP:386) and the ISO date (GPP:303). Replace the "…" busy labels, make messages live, add the password hint and a text mode toggle.
3. **Unpublish, or make functional, "Aportar al mapa"**: the MA page, `AppLayout.astro:73-76` and MI:55-58. It is a dead end in the primary nav. Also remove the false claim "observaciones comunitarias revisadas" (TI:26-27).
4. **Fix the misleading Goals sheet.** Calculation-tab settings apply immediately while the footer says "Sin cambios" and Cancel can't revert them (GRT:1928-2054). Delete the inconsistent duplicate time-zone select (GRT:1795-1807).
5. **Fix Guild data localization.** Portuguese ranks in the es/en UI, search and PNG (`guild-ranking.ts:576`); pt-BR number grouping in en; raw `lastLogin`; DD/MM in en. Fix the PNG/UI band mismatch (IMG:250 vs GRT:915).
6. **De-duplicate the Guild workspace chrome:**
   - "Clasificación" appears 3 times (GRT:1341, 1433, 1467);
   - the member badge (GWC:35), the Cobertura and Guardado contexts (GRT:1354-1366) and the IANA zone (GRT:1441);
   - the "visibles" count (GRT:1468-1471), the "Delta calculado" badges (GRT:1726), "Ver JSON" (GRT:1727-1737) and the ellipsis column (GRT:1570-1581);
   - the Activity methodology notes (GRT:1611-1613, 1670) and the unreachable empty states;
   - the wrong empty-state reference to "campo anterior" (GRT:301/479).
7. **Rewrite the tools index to a plain list** (TI): delete the intro, eyebrow, all status badges and the "planned" roadmap rows that look clickable. Align the tool names with the nav.
8. **Migrate the guild PNG** to the Codex tokens, self-hosted Poppins/Inter awaited via `document.fonts`, a 12 px floor, Title Case labels, localized dates and numbers, and no methodology footer (IMG:60-303). This is forced in Corte 0 because Verdana and the old palette are removed.
9. **Consolidate the guild/map CSS:**
   - delete the 64 dead classes;
   - collapse the stacked guild skins (`w:3203-5496` ×3, `g:1395-2206`, `g:3243-3364`; 327 shadowed declarations) and the 7 map rules defined twice (`g:699/739`, `705/743`, `753/1051`, `881/909`, `967/984`, `1012/1021`, `721/732`);
   - map every surviving literal to `--cx-*`;
   - resolve the premium badge conflict (`w:3551` vs `4841`);
   - move gold state and focus to blue (`g:737, 830-854, 1619`…; `w:3306-3310`);
   - apply the 12/13/14/16/20 type scale and 40 px controls.
10. **Fix map controls and a11y:**
    - per-floor legend counts (ME:314) and accent-insensitive search (ME:125-131, 34);
    - one filter system instead of two (ME:258-317);
    - floor-arrow labels and direction (ME:411-436, confirm z orientation with the owner);
    - 40 px marker hit areas, and a blue selection ring distinct from focus (`w:1440-1447`);
    - keyboard pan/zoom, and the marker details panel as the `GameCard` + `StatRow` Corte 0 pilot.