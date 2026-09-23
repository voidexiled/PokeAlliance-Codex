# Corte 0 audit: shared shell and generic pages

Read-only audit. No repo files were changed. The only file written was a helper script at `.../scratchpad/corte0/sample-search.cjs`, used to decode the built search payload. Lines below are verified against the current worktree. Findings from the built output were checked in `.vercel/output/static`.

## 1. Inventory

| Route / component | Purpose | Used? |
|---|---|---|
| `src/pages/index.astro` | `/` sends visitors to `/es/`. Because the page is prerendered, this becomes an HTML page with a 2 s meta refresh and English text ("Redirecting from / to /es/"). | yes |
| 404 page | **Missing.** There is no `src/pages/404.astro`, so `.vercel/output/config.json` routes misses to `_render` and Astro's default English 404 is shown, with no site shell. | — |
| `src/pages/[locale]/index.astro` + `src/styles/home.css` | Home: a hero (kicker, H1, search, gold CTA), 3 hard-coded starters, 4 route cards and a Server Save widget. | yes |
| `src/pages/[locale]/buscar/index.astro` | Global search page. It sends all 915 records as island props (313 KB of HTML in es). | yes |
| `src/pages/[locale]/cambios/index.astro` | Changelog. It is empty, but it is in the main nav. | yes |
| `src/layouts/AppLayout.astro` | Page head, fixed topbar (brand, search, language switch, 2 fake icons), sidebar in 3 groups plus a Server Save note, `<details>` mobile nav, main. | every page |
| `src/i18n/config.ts` | Locale list, language labels, shell strings (`localeCopy`). | yes |
| `src/components/wiki/AllianceWordmark.astro` | SVG emblem plus the "ALLIANCE CODEX" wordmark. Only the `header` variant is used; `home` is dead. | yes |
| `src/components/wiki/WikiSearch.tsx` | Search form used on home: icon button, input and a "Ctrl K" hint. | home only |
| `src/components/wiki/ContentSearch.tsx` | Client-side filter for /buscar: input, Search button, result count, rows, "Mostrar más". | buscar |
| `src/components/phase3/ServerSaveStatus.tsx` | Converts Server Save time to the visitor's time zone. | home |
| `src/components/wiki/WikiPortalPanel.tsx` | Card of index links. | **orphan** |
| `src/components/wiki/WikiSourceCard.tsx` | Source card for the deleted `/fuentes` page. | **orphan** |
| `src/components/wiki/EvidenceTrail.astro` | "Provenance" evidence list. | **orphan** |
| `src/components/wiki/DataStatus.astro` | supported / inferred / unknown label. | **orphan** |
| `src/components/wiki/RecordCard.astro` | Generic entity card. | **orphan** |
| `src/components/phase3/ReadinessPanel.tsx` | Old "foundation ready" marketing hero. | **orphan** |
| `src/components/phase3/RoutePlaceholder.astro` | "Section status" placeholder. | **orphan** |

The seven orphans are imported nowhere in `src/` or `tests/`.

## 2. Content slop

Unless a row says otherwise, "es/en" means both locales. **Vocabulary rule used below:** every search box uses the same wording, es "Buscar Pokémon, items o misiones" / en "Search Pokémon, items or quests". "items" matches the in-game "Held Items"; "misiones" matches the existing collection label. **The owner should confirm this vocabulary.** If "items" is confirmed, also change the collection label 'Objetos' to 'Items' in `repository.ts:94`, which is outside this scope.

| file:line | loc | current text | problem | action |
|---|---|---|---|---|
| AppLayout.astro:37,99 | both | default title `'Alliance Codex'` inside the template `{title} · Alliance Codex` | page title; the default renders the brand twice | REPLACE: let a page override the full title. Home: es "Alliance Codex · Wiki de PokeAlliance" / en "Alliance Codex · PokeAlliance wiki" |
| AppLayout.astro:38 | en | default description 'Wiki comunitaria de PokeAlliance.' | English pages get a Spanish description | REPLACE per locale: es "Wiki comunitaria de PokeAlliance." / en "PokeAlliance community wiki." |
| AppLayout.astro:53 + :181 | both | group heading "Herramientas" and its first link "Herramientas" | duplicated label | REPLACE the link text: es "Todas las herramientas" / en "All tools" |
| AppLayout.astro:56,62 | both | 'Comparar Pokémon' / 'Ranking de guild' written inline | real labels, but outside i18n | KEEP the text; move it to `localeCopy` |
| AppLayout.astro:74 | en | 'Contribute to map' | grammar; written inline | REPLACE en with "Contribute to the map" (es unchanged); move to i18n |
| AppLayout.astro:71 | both | nav entry "Cambios" | leads to an empty page | DELETE the entry until the first changelog entry exists |
| AppLayout.astro:117 | both | sr-only label 'Buscar en Alliance Codex' | fine | KEEP; move to i18n |
| AppLayout.astro:123-125 | both | 'Busca Pokémon, items o quests' | wording differs from home and ContentSearch; "quests" in es | REPLACE with the unified text above |
| AppLayout.astro:134,137 | both | visible "Español" but aria-label 'Cambiar a English' | wrong aria: the accessible name does not contain the visible label (WCAG 2.5.3); mixed languages | REPLACE: show the target language ("English" with `lang="en"` on es pages, "Español" with `lang="es"` on en pages); drop the aria-label |
| AppLayout.astro:143 | both | title 'Navegación lateral' / 'Side navigation' | fake control | DELETE |
| AppLayout.astro:151 | both | title 'Tema oscuro' / 'Dark theme' | fake control (the site is dark-only) | DELETE |
| AppLayout.astro:226-227 | both | 'Servidor' plus 'Server Save · 00:00 BR' | duplicated label; "BR" unexplained; identical in both locales | REPLACE with one line: es "Server Save: 00:00 (hora de Brasilia)" / en "Server Save: 00:00 (Brasília time)" |
| AppLayout.astro:232 | both | summary 'Navegación principal' / 'Main navigation' | a landmark name used as button text | REPLACE: es "Menú" / en "Menu"; keep the aria-label on the `<nav>` |
| AppLayout.astro:161 | both | aria-label on `<aside>` | a complementary landmark named "navigation" | move the label onto the inner `<nav>` (:162) |
| AppLayout.astro (no footer) | both | — | missing legal notice | ADD a one-line footer (owner decision): es "Proyecto comunitario no oficial. No está afiliado a PokeAlliance, Nintendo ni The Pokémon Company." / en "Unofficial community project. Not affiliated with PokeAlliance, Nintendo or The Pokémon Company." |
| i18n/config.ts:28,48,67 | both | status 'Estado del proyecto' / 'Project status' | project/process text; unused | DELETE |
| i18n/config.ts:29,49,68 | both | publicFoundation 'Fundación pública' / 'Public foundation' | project/process text; unused | DELETE |
| i18n/config.ts:27,47,66 | both | language 'Idioma' / 'Language' | unused | DELETE |
| AllianceWordmark.astro:33-34 | both | "ALLIANCE" / "CODEX" | logo; `aria-hidden`, and the brand link has a name | KEEP |
| WikiSearch.tsx:44 | both | `Ctrl K` | fake shortcut: no handler exists anywhere, and Ctrl+K is taken by browsers | DELETE, or REPLACE with "/" once a global `/` handler exists |
| WikiSearch.tsx:30 (with index.astro:101) | both | button aria-label is the long placeholder text | duplicated label | REPLACE: button es "Buscar" / en "Search" |
| ContentSearch.tsx:25,32,80 | both | 'Buscar Pokémon, misión, objeto o sistema…', also used as the label | inconsistent vocabulary; there is no "systems" collection to search; ellipsis inside the accessible name | REPLACE the placeholder with the unified text; label es "Buscar" / en "Search" |
| ContentSearch.tsx:26,33,94-97 | both | 'Buscar' / 'Search' submit button | does nothing visible (results filter live; it only calls `replaceState`) | DELETE the button; Enter keeps updating the URL |
| ContentSearch.tsx:27,34,104 | both | "915 resultados" shown before any query, in mono uppercase | filler; "1 resultados" plural bug | REPLACE: show only when the query is not empty, using `Intl.PluralRules`: es "1 resultado" / "{n} resultados", en "1 result" / "{n} results" |
| ContentSearch.tsx:28,35 | both | 'No hay registros que coincidan…' / 'No records match…' | "registros" / "records" is data jargon | REPLACE: es "Sin resultados para «{q}»." / en "No results for “{q}”." |
| ContentSearch.tsx:29,36 | both | 'Mostrar más' / 'Show more' | real control | KEEP |
| ContentSearch.tsx:116 | both | collection kicker on every row ("POKÉMON" ×910) | kicker; repeated label | DELETE; if needed, add collection filter chips: es "Todo · Pokémon · Items · Movimientos · Misiones · Ubicaciones · Rotaciones" / en "All · Pokémon · Items · Moves · Quests · Locations · Rotations" |
| ContentSearch.tsx:121 (from buscar:28) | both | meta values `normal`, `shiny`, `training_charger`, `city` | raw internal values, English in es | REPLACE: hide `normal`; `shiny` becomes the chip "Shiny"; other kinds go through a localized dictionary, and unknown kinds are hidden |
| ContentSearch.tsx:123 (from buscar:29) | es | English summaries such as "Adds 20,000 standard-progress charges to the Punching Bag" | untranslated | REPLACE: show only summaries in the page's language, otherwise mark them `lang="en"` |
| buscar/index.astro:35,43 | both | 'Buscar en el Codex' / 'Search the Codex' (so the tab reads "…Codex · Alliance Codex") | "Codex" twice in the title | REPLACE: es "Buscar" / en "Search" |
| buscar/index.astro:36-37,44 | both | description mentions "registros normalizados" / "normalized records" | data-pipeline jargon | REPLACE: es "Busca Pokémon, items y misiones de PokeAlliance." / en "Search PokeAlliance Pokémon, items and quests." |
| buscar/index.astro:38,45,63 | both | eyebrow 'Wiki Core / Search' | developer / phase name, English in es; hidden by `wiki-reference.css:512-514` but still in the HTML | DELETE |
| buscar/index.astro:39-40,46-47,65 | both | "La búsqueda recorre el catálogo disponible…" | intro that explains how search works | DELETE |
| buscar/index.astro:54-61 | both | breadcrumb "Inicio / Buscar en el Codex" | redundant on a top-level page | DELETE |
| cambios/index.astro:16,23 | both | description "…revisiones y cambios documentados de la wiki" | process text | REPLACE: es "Cambios de PokeAlliance y de Alliance Codex." / en "PokeAlliance and Alliance Codex changes."; add `noindex` while the page is empty |
| cambios/index.astro:17,24,43 | both | intro 'Historial conciso de actualizaciones importantes…' | restates the title and describes itself | DELETE |
| cambios/index.astro:41 | both | eyebrow 'Historial de la wiki' / 'Wiki history' | kicker (hidden by CSS) | DELETE |
| cambios/index.astro:47 | both | eyebrow 'Sin entradas todavía' / 'No entries yet' | kicker that repeats the h2 | DELETE |
| cambios/index.astro:18,25,48-50 | both | h2 'El registro todavía no tiene entradas publicadas.' | filler empty state rendered as a heading | REPLACE with a `<p>`: es "Aún no hay cambios publicados." / en "No changes published yet." |
| cambios/index.astro:19,26,51 | both | 'Las novedades se incorporarán aquí cuando…' | filler; the empty state is said three times | DELETE |
| cambios/index.astro:32-39 | both | breadcrumb | redundant | DELETE |
| index.astro:34,54 | both | title 'Inicio' / 'Home' | weak home title | REPLACE with the full home title from the first row |
| index.astro:35,55 | both | description 'Pokédex, mapa, guías y herramientas de PokeAlliance.' | useful | KEEP |
| index.astro:36,56,96 | both | kicker 'Alliance Codex' | repeats the topbar brand | DELETE |
| index.astro:37,57,97 | both | H1 'Encuentra lo que necesitas para jugar.' / 'Find what you need to play.' | tagline / slogan (PRODUCT.md anti-reference) | REPLACE: es "Wiki de PokeAlliance" / en "PokeAlliance wiki" |
| index.astro:38,58 | both | 'Buscar Pokémon, items, misiones o sistemas' | inconsistent; "sistemas" cannot be searched | REPLACE with the unified text |
| index.astro:39,59,106-109 | both | 'Explorar Pokédex' gold CTA | the 4th link to /pokedex/ on the page; gold used as an action | DELETE |
| index.astro:40,60,112,114 | both | 'Pokédex de PokeAlliance' (mono, 9.9 px) | decorative section label; "de PokeAlliance" is redundant | DELETE together with the roster (§4); if the roster stays, es/en "Pokédex" |
| index.astro:41,61,115 | both | 'Ver todos los Pokémon ↗' | ↗ used on an internal link | KEEP only if the roster stays; remove ↗ |
| index.astro:42,62,137 | both | 'Explorar la wiki' | heading over a copy of the sidebar | DELETE |
| index.astro:43-50,63-70 | both | route cards with descriptions ('Especies, variantes y tipos', 'Pisos, coordenadas y marcadores', 'Misiones y ubicaciones', 'Comparar Pokémon y gestionar tu guild') | duplicate the nav, with helper text | DELETE the grid. Mobile reaches these through a better menu (§3). If the grid is kept below 1280 px, at least DELETE the descriptions |
| index.astro:51,71,157 | both | section aria-label 'Server Save' | repeats the inner h2 | DELETE the aria-label |
| index.astro:120 | both | `aria-label={entry.name}` | repeats the visible name | DELETE |
| index.astro:142 | both | `aria-label={route.title}` | overrides and hides the description from screen readers | DELETE |
| ServerSaveStatus.tsx:22,27 | both | 'Server Save' | vague about what is shown | REPLACE: es "Próximo Server Save" / en "Next Server Save" |
| ServerSaveStatus.tsx:23,28,40 | both | 'Hora canónica convertida a tu zona' / 'Canonical time converted to your zone' | developer / process text | DELETE |
| ServerSaveStatus.tsx:36-38 | both | green badge "Temporal" (the name of a JS library) | developer text; the badge adds nothing | DELETE |
| ServerSaveStatus.tsx:24,29,46 | both | 'Tu fecha local: America/Sao_Paulo' | wrong label; raw time-zone ID | DELETE |
| ServerSaveStatus.tsx:43 | both | '2026-09-17 · 00:00' | raw ISO date, stale (see §3) | REPLACE with `Intl` formatting: es "hoy, 22:00 · en 3 h 12 min" / en "today, 10:00 PM · in 3 h 12 min" |
| ServerSaveStatus.tsx:49 | both | '00:00 · America/Sao_Paulo' | raw ID | REPLACE: es "00:00 hora de Brasilia" / en "00:00 Brasília time" |
| ReadinessPanel.tsx:22-83,101-104,143,145-147 | both | 'Núcleo operativo'; 'La base para jugar con contexto.' (en is 'A better way…', not a translation); marketing description; 'Fundación lista' badge; cards "Modelo con provenance… normalizador", "x/y/z… pendientes", "Correcciones trazables"; 'Phase 3'; ↗ | every category: kicker, tagline, project/process text, developer text, badge, fake arrow | DELETE the file |
| RoutePlaceholder.astro:16-23 | both | eyebrow / title / description / 'Estado de esta sección' / nextStep | project status text | DELETE the file |
| EvidenceTrail.astro:14-25 | both | 'Provenance' (English in es); 'De dónde sale este dato'; 'Abrir fuente' / 'Open source' (ambiguous in en); 'Este registro todavía no tiene evidencia…' | against PRODUCT.md "Confianza silenciosa" (keep provenance quiet); filler | DELETE the file |
| DataStatus.astro:9-13 | both | 'Respaldado' / 'Inferido' / 'Desconocido'; raw `status.replaceAll('_',' ')` | badges; raw internal values | DELETE; the new StatRow "No informado" state replaces it |
| RecordCard.astro:26,37-39,44 | both | collection kicker; mono uppercase raw kinds; decorative "→" | kicker; raw values; fake affordance | DELETE (rebuild as GameCard, §4) |
| WikiSourceCard.tsx:35,38,45-46,63,71 | both | raw sourceType; authority shown twice (badge and dl); evidence counter; "local" | raw values; duplicated label; evidence counters (anti-reference) | DELETE the file |
| WikiPortalPanel.tsx:7,28,37 | both | count / meta badges; `description` prop never rendered | badges; dead prop | DELETE the file |
| src/pages/index.astro:4 | both | built page shows "Redirecting to: /es/" / "Redirecting from / to /es/" | English-only, 2 s wait | REPLACE with a platform redirect (`redirects` in `vercel.json` or astro config; optionally English when Accept-Language is `en`), so no HTML is shown |
| 404 (missing) | both | Astro default "404: Not found" | English, no shell | ADD `src/pages/404.astro` (`prerender = false`; pick the locale from the path): es "Página no encontrada" + "Ir al inicio" + search box / en "Page not found" + "Go to home" |

## 3. Fake or broken controls and dead UI

1. **Global search is broken.** `buscar/index.astro:49` reads `Astro.url.searchParams` on a prerendered page, so at build time `q` is always empty. The built props contain `initialQuery":[0,""]`. The topbar form (`AppLayout.astro:114`) and the home form (`WikiSearch.tsx:23`) send `?q=…`, but the page opens with an empty box and all 915 results. **Fix:** in `ContentSearch.tsx:54`'s mount effect, `setQuery(new URLSearchParams(location.search).get('q') ?? '')`; stop passing `initialQuery` from the page.
2. **The search input is disabled until the page hydrates** (`ContentSearch.tsx:85,94`). Without JS it cannot be used, and it flashes at 50% opacity. **Fix:** always keep it enabled; hydration takes over the value.
3. **The Server Save widget is frozen at build time.** `index.astro:20` computes `canonicalDate` during the build. The build from 2026-09-17 already shows a past date today. The server render also shows São Paulo time first and then jumps to local time (`ServerSaveStatus.tsx:12-16`). **Fix:** calculate the next São Paulo midnight on the client. The server render shows only "00:00 hora de Brasilia" and the client adds local time and the countdown.
4. **Fake topbar icons** `PanelLeftIcon` / `MoonIcon`, with dividers (`AppLayout.astro:140-155`, CSS `wiki-reference.css:257-278,1668-1671`). **Fix:** DELETE.
5. **The language switch looks like a dropdown** (`ChevronDownIcon`, `AppLayout.astro:138`) and always goes to the root of the other language (`:132`), so the current page is lost. `hreflang` also points only to the roots (`:97-98`). **Fix:** plain link to the equivalent path (`currentPath.replace(/^\/(es|en)/, '/'+alt)`), keep the query string, no chevron, per-page `hreflang` plus `x-default`.
6. **"Ctrl K" hint with no handler** (`WikiSearch.tsx:44`). The only shortcut handler is `/`, inside `PokedexGrid.tsx:100-115`. **Fix:** DELETE, or add a global `/` handler in AppLayout and show "/".
7. **The ContentSearch Search button is a no-op** (`:94-97`). **Fix:** DELETE.
8. **"↗" (external-link arrow) on internal links:** `index.astro:108,115,150`. **Fix:** remove the icon, or use a → chevron.
9. **Decorative gold bar that looks like a meter** (`home.css:27-36`) and a decorative ring behind each sprite (`home.css:182-192`). **Fix:** DELETE.
10. **Cambios in the nav leads to a page with no entries** (`AppLayout.astro:71`). **Fix:** hide the entry and add `noindex` until there is content.
11. **No search in the mobile topbar:** it is hidden below 768 px (`wiki-reference.css:215-219`). **Fix:** show a 40 px icon *link* to `/buscar/` below 768 px.
12. **Two search boxes on the home page** (topbar `AppLayout.astro:114` and hero `index.astro:99`), both `role="search"` with no distinct name. **Fix:** hide the topbar search on home, or name both.
13. **Root redirect waits 2 s** and there is no custom 404 (see §2).
14. **Dead code paths:**
    - `isHome`, `wiki-shell-home` and `wiki-topbar-inner-home` (`AppLayout.astro:43,103,105`): same styles as the normal classes (`wiki-reference.css:59-60`).
    - The `home` wordmark variant (`AllianceWordmark.astro:3,6`; CSS `wiki-reference.css:142-164,1694-1710`).
    - `RecordCard.astro:12`: the `locale` prop is never used. At `:24,29` the stretched link has no `relative` parent, so its overlay escapes the card.
15. **Dead CSS to remove along with the orphan components:**
    - `wiki-reference.css`: 430-442 and 3197 (`.wiki-footer`); 599-863 (`wiki-home-*`, `wiki-featured-*`, `.wiki-search`); 901-995 (`wiki-index-*`, `wiki-document-grid`); 996-1127 (`wiki-source-*`); 1273-1311 (`wiki-evidence*`); 512-514 (rule that hides eyebrows).
    - `global.css`: 133-150 (`.wiki-brand-mark/-name/-subtitle`); 160-200 (`.wiki-search*`); 210-222 (`.wiki-status-mark`, `.status-dot`); 291-296 (`.wiki-sidebar-bullet`); 631-666 (`wiki-evidence*`); 2971-3085 (`wiki-source-*`); 3119-3230 (`wiki-index-*`); and all of `@layer legacy-wiki` (2440-3364).

## 4. Game-layer candidates

| Surface | Entity | Priority | Why / how |
|---|---|---|---|
| Search result rows, `ContentSearch.tsx:109-126` + `buscar/index.astro:21-31` | Pokémon (910 of 915 rows); later item / move / quest | **Corte 0 pilot (1st)** | Most-used generic list in scope, and 99% game entities. Build a compact "game row": 32 px beveled `SpriteSlot`, name in Poppins 600 16px on `--cx-value`, type chips (keep domain colors), "Shiny" as a text chip, no kicker, no `h2`. Pass `image` and `types` in `SearchItem`. This also tests "name only the clicked card": set `pokemon-art-<slug>` in `pageswap`; the detail page already matches it at `pokedex/[slug].astro:102,139`. |
| Home roster tiles, `index.astro:112-132` / `home.css:108-241` | 3 hard-coded starters | **Corte 0 pilot (conditional)** | As content it is decoration, so DELETE by default. If the owner wants a Pokémon strip, it must show real information (e.g. current rotation) and use the game mini card: `--cx-card`, 8 px, bevel slot, Poppins name, e1 hover, no red wash, no drop-shadow. |
| `RecordCard.astro` (rebuilt as `GameCard`, the UnitTooltip "card" variant) | any record | **Corte 0 component, used later** | The generic entity card for sistemas / guías / rotaciones. Gold "Label:" rows (`dt`) with white tabular values (`dd`) (StatRow), plus a "No informado" state that replaces `DataStatus.astro`. |
| Item rows in search | items (1 record today) | Later (Corte 2 catalogs) | Same row, with an item sprite and a kind row. |
| Changelog entries | entities mentioned in future entries | Later | Inline entity chips with a small popover. |
| Stays shell (Inter): AppLayout, WikiSearch, ServerSaveStatus (schedule, not an entity), breadcrumbs, 404, empty states | — | — | Not game entities. Sidebar Comercio sprite (`AppLayout.astro:207-214`): keep as an icon (64 px source shown at 16 px is an exact 4× reduction). |

## 5. Migration notes

**Token source**
- `global.css:31-57` and `wiki-reference.css:7-33` are two parallel token sets. Replace both with one `--cx-*` source and keep `--wiki-*` as temporary aliases:

| Current token | Current value | New token (value) |
|---|---|---|
| `--wiki-page-bg` | #0c0e12 | `--cx-canvas` (#0F1318) |
| `--wiki-surface` | #0c0e12 (same as the page) | `--cx-surface` (#161B22) |
| `--wiki-surface-secondary` | #13161b | `--cx-recess` (inputs) or `--cx-raised` (headers) |
| `--wiki-hover` | #22262f | `--cx-raised` (#262B32) |
| `--wiki-line` | #22262f | `--cx-line` (#2E3540) |
| `--wiki-line-strong` | #373a41 | `--cx-line-strong` (#646D7C) |
| `--wiki-copy` | #f7f7f7 | `--cx-copy`; values use `--cx-value` |
| `--wiki-copy-secondary` | #cecfd2 | `--cx-copy-2` |
| `--wiki-copy-tertiary` / `-disabled` / `-quinary` | #94979c / #85888e / #61656c | `--cx-muted` (#8A919C); quinary is 3.3:1 and fails as text |
| `--wiki-link` / `--wiki-focus` | #93c5fd / #444ce7 | `--cx-blue-hi` |
| `--wiki-brand-blue` | #3b9fd8 | `--cx-blue` |
| `--wiki-brand-gold` | #e8a238 | `--cx-gold` |
| `--wiki-success` / `--wiki-error` | — | `--cx-success` / `--cx-danger` |
| `--wiki-radius-control` | .5rem | 6 px |

- Tokens used but never defined: `--wiki-copy-quaternary` (`wiki-reference.css:184`).
- shadcn tokens:
  - `--primary` becomes `--cx-blue` with ink #0B1A2B;
  - `--accent` and `--ring` become `--cx-blue-hi`;
  - `--input` becomes `--cx-line-strong`;
  - `--card` becomes `--cx-surface` (shell cards). Game cards use a separate `GameCard` on `--cx-card`.

**Head and theme**
- `AppLayout.astro:94` theme-color #111318 → #0F1318.
- `AppLayout.astro:89` add `class="dark"`, and add `@custom-variant dark (&:where(.dark, .dark *));` to `global.css`. Today `dark:` classes follow the operating system. Example: the outline Button used in `ContentSearch.tsx:94,134` renders differently on light and dark OS (`ui/button.tsx:12`).
- `AppLayout.astro:92` add `initial-scale=1`.
- Add `site` to `astro.config.mjs:8-15` so canonical, absolute `hreflang` and Open Graph URLs can be generated (none exist today).

**Fonts**
- `global.css:32-34` (Verdana / Cascadia) and the hard-coded Verdana at `wiki-reference.css:103` → Inter Variable (body, all numbers, `tabular-nums`) and Poppins 600/700 (page titles, game voice, wordmark).
- Self-host them with Astro 7's `fonts` config plus a preload in the AppLayout head.
- Mono only for IDs and coordinates. These must move off mono:
  - `wiki-reference.css:402` (sidebar note), `:1247` (row meta);
  - `ContentSearch.tsx:101`;
  - `ServerSaveStatus.tsx:42,46,49`;
  - `home.css:124,223`.

**Type scale (12 px floor)**

| Location | Now | Target |
|---|---|---|
| `wiki-reference.css:403` | 10px | 12 |
| `wiki-reference.css:410`, `:448`, `:1248`, `:1260` | 11px | 12 |
| `wiki-reference.css:208` | 11.5px | 16 mobile / 14 desktop |
| `wiki-reference.css:134`, `:138` (wordmark) | 10.9 / 9.3px | ≥12, or an SVG wordmark |
| `wiki-reference.css:229`, `:333`, `:355`, `:488`, `:1610`, `:1626` | 12px | 13–14 |
| `wiki-reference.css:712` and `ui/kbd.tsx:7` | 10px | delete the Ctrl K kbd |
| `home.css:75` | 12.5px | 16/14 |
| `home.css:88` | 12px | 14 |
| `home.css:125` | 9.9px | — |
| `home.css:134` | 10.4px | — |
| `home.css:238` | 11.2px | Poppins 13 |
| `home.css:317` | 11.2px | 13 |
| `home.css:312` | 13px | 14 |
| `.display-title` `wiki-reference.css:458-462` and `home.css:46-49` (weight 760, −0.06em) | — | Poppins 700 `clamp(28px,3vw,40px)`, tracking 0 |
| `.section-title` `:468` | — | Poppins 600 20px |
| `ServerSaveStatus.tsx:42` | — | Inter 20px 600 tabular |

**Radii**

| Location | Now | Target |
|---|---|---|
| `wiki-reference.css:182` | .5rem | 6 |
| `:226` | 11px | 6 |
| `:352` | 8 | 6 |
| `:652` (search control) | 12 | 6 |
| `:676` (search button) | 8 | 6 |
| `home.css:13` | 18px | 12 (or remove the container) |
| `home.css:61` | .65rem | 6 |
| `home.css:84` | .55rem | 6 |
| `home.css:275` | .8rem | 8 |
| `home.css:325` | .8rem | 12 |
| `ui/button.tsx:6`, `ui/input.tsx:11` (`rounded-lg` = 8) | 8 | 6 |
| `ui/card.tsx:14` (`rounded-xl` = 12) | 12 | OK for shell; GameCard 8 |

**Colors outside the tokens (home.css)**
- `:12` → `--cx-line`; `:14` → `--cx-surface`; `:60` → `--cx-line-strong`; `:62` and `:71` → `--cx-recess`.
- `:45` → `--cx-value`.
- `:113`, `:151`, `:163`, `:196` (red roster) → the `--dex-red-dark` domain token (`wiki-reference.css:1747`) or delete.
- `:123`, `:132`, `:165`, `:237` → `--cx-value` / `--cx-copy`.
- `:155`, `:171`, `:175`, `:179` duplicate the type palette with different values (`wiki-reference.css:2387-2460`). Move the type colors to one global `[data-type]` set.
- `:276` and `:326` → `--cx-surface`; `:288` → `--cx-line-strong`; `:289` → `--cx-raised`.

**Gold misuse** (gold is for game labels, the compact meter and at most one CTA)
- `home.css:34` (bar) and `:39` (kicker): delete.
- `home.css:85,97` (CTA): delete, or use `--cx-blue` if a CTA survives.
- `home.css:70` and `wiki-reference.css:191` (gold focus border): → 2px `--cx-blue-hi` ring.
- `home.css:296` (route icons): → `--cx-copy-2`.
- Wordmark gold inside the home link (`wiki-reference.css:83,110`): document this as an explicit brand exception in DESIGN.md.

**Focus and contrast**
- `global.css:78` ring → `--cx-blue-hi`.
- `global.css:83` `::selection` #3730a3 → a blue-tint token.
- `wiki-reference.css:204` and `:698-702` remove the input outline. The replacement border (`:666`, #373a41 on #0c0e12) is 1.69:1 and fails. Put the 2px blue-hi ring on the whole control with `:focus-within`.

**Touch targets (40 px)**

| Location | Now |
|---|---|
| `wiki-reference.css:348` sidebar links | 28 |
| `:1606-1612` mobile menu summary | ~36 |
| `:1622-1629` mobile menu links | ~32 |
| `:223` language link | 36 |
| `:178` topbar search | 36 |
| `:672-673` and `WikiSearch.tsx:30` search button | 28 |
| `ui/button.tsx:23` Button default `h-8` | 32 |

**Elevation**
- `home.css:205` drop-shadow filter on sprites: delete.
- `home.css:290` hover translate: → e1 `0 6px 16px rgb(0 0 0/.28)`.
- `home.css:211`: keep as a small sprite lift using d2.

**Motion**

| Location | Now | Target |
|---|---|---|
| `wiki-reference.css:186-187` | 160ms | d2 140 |
| `:360-361`, `:657-658` | 120ms `ease` | d2, token ease |
| `home.css:92`, `:167`, `:281-283` | 180ms | d2 |
| `home.css:93` | 120ms `ease-out` | d1 90 |
| `home.css:206` | 230ms | d3 200 |
| `wiki-reference.css:1740` | 220ms | d5 320 for cross-page morphs |

- Reduced motion:
  - `wiki-reference.css:3133-3136` sets 1ms; replace with `@view-transition{navigation:none}`;
  - `global.css:69` smooth scroll has no guard;
  - `home.css:384-397` should use the shared tokens.
- AppLayout needs a small inline `pageswap` / `pagereveal` script (names only the clicked card, adds `to-detail` / `back` types). This is Corte 0 infrastructure.

**Layout and breakpoints**
- `wiki-reference.css:284-299` keeps an empty 13rem right column. At 1280 px the content is only about 752 px wide. Drop the column below ~1600 px.
- Breakpoints `wiki-reference.css:215,1648,1667,3153` and `home.css:329,344` (767 / 1023 / 639 / 900 / 600) → consolidate to 768 / 1280.

**Duplicate selectors to reconcile first**
- `.wiki-topbar` (`global.css:107,2458`; `wiki-reference.css:47`)
- `.wiki-sidebar*` (`global.css:243-310,2538-2604`)
- `.locale-link` (`global.css:223,2520`)
- `.eyebrow` / `.display-title` (`global.css:339,347,2619`)
- `.wiki-search-control` (`global.css:2894-2935`)
- `.wiki-data-row` (`global.css:591,3105`)
- `.wiki-empty-state` (`global.css:668`)

`legacy-wiki` is declared last, so it beats utilities. Example: `hover:border-accent/60` at `ContentSearch.tsx:111`.

**ContentSearch classes**
- `:101` → Inter 13 `tabular-nums`, normal case.
- `:111` → hover background `--cx-raised`.
- `:117` → a `<span>` in Poppins 600 16 for game rows.

**Brand assets**
- `public/favicon.svg` (#171A2A, #F5C56A, #70D2D0, and a check-mark glyph) does not match the wordmark emblem (`AllianceWordmark.astro:12-29`). Align it to the cx tokens.
- `AllianceWordmark.astro:21,26` → `--cx-canvas`, `--cx-blue`.

**Tests to update on purpose**

| `tests/e2e/smoke.spec.ts` | What it asserts |
|---|---|
| `:12` | home title |
| `:16`, `:160` | H1 text |
| `:18` | Server Save test id |
| `:166-201` | Verdana font, 1px border, `shadow: none` on hero and route cards, main box x=491 / width=1536 |
| `:374-378` | search box found by the current placeholder text |
| `:472` | Cambios page |

## 6. i18n parity and accessibility

**i18n**
1. The language switch and `hreflang` lose the current page (`AppLayout.astro:97-98,132`); there is no `x-default` and no absolute URLs.
2. Shell strings are written inline instead of in `localeCopy`: `AppLayout.astro:56,62,74,109,117,123-125,134,143,151,226`; `buscar/index.astro:56,58`; `cambios/index.astro:34,36,41,47`.
3. The default description is Spanish on English pages (`AppLayout.astro:38`).
4. The Spanish search page shows English summaries and raw internal values (§2).
5. No plural handling (`ContentSearch.tsx:104`).
6. Dates and times are not localized (`ServerSaveStatus.tsx:43`; `formatServerSaveForDisplay` in `lib/time/server-save.ts:47` exists but is unused).
7. English-only system pages: the root redirect (`src/pages/index.astro`) and the default 404.
8. In the orphan files: "Phase 3" is English in both locales (`ReadinessPanel.tsx:143`); the es and en titles are not translations of each other (`:23` vs `:55`); 'Provenance' in es (`EvidenceTrail.astro:14`).
9. Inconsistent search vocabulary: items / objeto, quests / misiones, "sistemas" (§2).

**Accessibility**
1. The visible language label is not in its accessible name (`AppLayout.astro:134,137`). The language name has no `lang` attribute.
2. `<aside aria-label="Navegación principal">` with an unnamed `<nav>` inside (`:161-162`). The mobile menu button text is a landmark name (`:232`). The mobile menu flattens the 3 groups (`:235`).
3. Two unnamed `role="search"` regions on home (§3.12).
4. Latent duplicate id: `WikiSearch.tsx:33,37` falls back to `global-search`, which already exists at `AppLayout.astro:120`.
5. One `<h2>` per result, up to 60 at a time (`ContentSearch.tsx:117`); `RecordCard.astro:27` does the same.
6. Focus indicator removed or too weak on both search inputs (§5).
7. Touch targets under 40 px and text under 12 px (§5).
8. Failing-contrast text: `--wiki-copy-quinary` in the sidebar note (`wiki-reference.css:401`) and breadcrumbs (`:487,504`).
9. Breadcrumb separator "/" is read aloud because it lacks `aria-hidden` (`buscar/index.astro:59`, `cambios/index.astro:37`).
10. `aria-label`s that override visible text (`index.astro:120,142`) and a section name repeated by its h2 (`:157`).
11. Search input disabled before hydration; the label is placeholder text with "…" (`ContentSearch.tsx:79-85`).
12. Reduced-motion gaps (`global.css:69`; view transitions shortened to 1 ms instead of turned off).
13. The Server Save value changes after hydration (content shift). If the countdown updates live, announce it only on open or with a polite, throttled update.
14. Inline `onerror` handler (`index.astro:122`) will conflict with a future strict CSP.

## 7. Top 10 fixes in this scope, ranked

1. **Fix the global search.** Read `?q` on the client and keep the input enabled (`buscar/index.astro:49`, `ContentSearch.tsx:50,54,85`). Today every search from the topbar or home lands on an unfiltered list.
2. **Remove the fake chrome and fix the language switch.** Delete the panel and moon icons and the language chevron; keep the page when switching language; per-page `hreflang` (`AppLayout.astro:97-98,130-155`). Also `smoke.spec.ts:162`, which only checks the link from the home page, so it will still pass after the fix.
3. **Rebuild ServerSaveStatus.** Calculate on the client, remove the "Temporal" badge, the "canonical time" line and the raw time-zone and ISO text, and show "Próximo Server Save: hoy, 22:00 · en 3 h" (`index.astro:20`, `ServerSaveStatus.tsx`). It is wrong on the live site today.
4. **Make home search-first.** Delete the kicker, the slogan H1, the gold CTA, the gold bar and ring decorations, the "Explorar la wiki" route grid and the roster (unless the owner keeps it as a game-layer pilot). Use a factual H1 (`index.astro:94-155`, `home.css`).
5. **Corte 0 foundation in the shell.** One `--cx-*` token source; blue-hi focus ring; `class="dark"` with a custom variant; self-hosted Inter and Poppins; motion tokens; reduced-motion view transitions; `pageswap` / `pagereveal` script (`global.css:31-85`, `wiki-reference.css:7-33,1735-1742,3133-3136`, `AppLayout.astro:89-100`).
6. **Delete the 7 orphan components and their CSS** (§3.15), plus `@layer legacy-wiki` and the unused i18n keys (`config.ts:27-29,47-49,66-68`). This removes about 1,500 lines that would otherwise have to be migrated.
7. **Game-layer pilot for search rows.** Sprite slot, Poppins name, type and "Shiny" chips; no per-row kicker or `h2`; no raw internal values; count only after typing, with correct plurals; unified placeholder; no Search button (`ContentSearch.tsx:94-126`, `buscar/index.astro:21-31`).
8. **Remove the slop from the search and changelog pages.** Hidden eyebrows, intros, breadcrumbs on top-level pages, the triple empty state, jargon in meta descriptions. Hide "Cambios" from the nav and add `noindex` until there are entries (`buscar/index.astro:35-66`, `cambios/index.astro:15-52`, `AppLayout.astro:71`).
9. **Shell accessibility pass.** 40 px targets, 12 px floor, drop quinary text, proper nav landmarks and a "Menú" / "Menu" button, a mobile search link, move strings to i18n (§5, §6).
10. **System pages and metadata.** Server-level root redirect (language-aware if possible), a localized 404, `site` plus canonical and Open Graph tags, locale-aware default description and home title, and the one-line non-affiliation footer (owner decision).