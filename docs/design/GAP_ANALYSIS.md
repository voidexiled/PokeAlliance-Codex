# Alliance Codex vs RubinOT wiki: gap analysis

Date: 2026-09-18.

**Inputs**
- **Current site:** captures of `http://127.0.0.1:4400/es/*` at 1440x900 and 390x844.
  - Folder: `scratchpad/corte0/shots/` (`es-*-desktop.png`, `es-*-mobile.png`, plus `states/` and `seg/`).
  - Text, heading, eyebrow, font-size and font-family dumps: `es-*-desktop.txt` and `.json`.
- **Reference:** `scratchpad/rubinot/RUBINOT_DESIGN_REFERENCE.md` (cited below as §n) and `scratchpad/rubinot/shots/`.
- **Owner images** (in `images/`):
  - `1.png`: in-game tooltip for a Shiny Ditto named "SUSANOO".
  - `2.png`: the in-game Entrenamiento window.
  - `3.webp`: RubinOT home.
- **Colors:** sampled from the PNGs with sharp.
- **Data:** file and record counts were read from `C:/Users/jalom/Documents/ChatGPT/PokeAlliance-Codex/data` and `public/`.

**Scope.** This document covers the design language only. Do not reuse RubinOT's logo, brand, wording or images.

---

## 0. Summary

- **Already on target.** The shell is closer to RubinOT than the pages are. These already match:
  - Page background #0c0e12.
  - Fixed 64px header with a bottom border.
  - 12px sidebar links on a 1px left rule.
  - #22262f active background.
  - 30px Verdana Bold inner h1.
  - 20px h2 with a 1px divider.
  - Header right cluster (language, layout, theme).
- **What breaks the language:**
  - The home page is a landing hero with a slogan and a gold CTA.
  - Display titles are 49, 72, 72 and 42px.
  - Surfaces are colored: red, maroon, brown, purple, green, and graphite on Comercio.
  - Official artwork is shown at 150–300px instead of pixel sprites.
  - Lucide icons are used as navigation.
  - Cascadia Mono is used for labels (247 mono text nodes on the Pokédex, against 178 Verdana).
  - Uppercase eyebrows sit on almost every block.
  - Raw data keys and English content appear on Spanish pages.
  - There is no footer and no right rail.
- **Missing from the brief:**
  - The in-game tooltip.
  - The Cards / Slots / Lista views.
  - The sprite registry and sheet component, used in pages.
  - An RMT marketplace. Only a local listing composer exists.
  - Guild analytics. Only a weekly ranking exists.
- **Blockers:**
  - **Sprite rights:** only 5 Pokémon outfits and 13 item images are public. 41 outfits sit in a private dump whose redistribution rights are not established.
  - **Data coverage:** 1 item, 1 move, 1 quest, 1 location and 1 rotation assertion. The 910 roster rows have no Held Items, Boost, drops, evolutions or spawns.

RubinOT page templates to reuse:

| RubinOT template | Screens | Alliance Codex pages |
|---|---|---|
| Home (§3) | `desktop-1440-home-*` | Inicio |
| Category with tables and TOC (§4.11) | `desktop-1440-item-category-backpacks-*` | Pokédex, Tiers, Guías index, search fallback |
| System page (§4) | `desktop-1440-system-battle-pass-*` | Sistemas pages, Mapa |
| Sub page with banner, cards, timeline, tabs and table | `desktop-1440-subpage-battle-pass-temporada-01-*` | Quest page, Tiers |
| Detail with head block and related box (§4.17) | `desktop-1440-item-detail-blessed-dwarven-backpack-*` | Pokémon detail, Comercio listing |
| Tool (§4.16) | `desktop-1440-tool-calculadora-de-skill-*` | Guild, Comparar Pokémon |
| Form (§4.16) | `desktop-1440-form-world-transfer-*` | Comercio publicar, Aportar al mapa |
| Timeline (§4.7) | `desktop-1440-timeline-castillo-*` | Cambios, quest steps, guild imports |

---

## 1. Shell gaps (apply to every page)

| # | Area | Alliance Codex now | RubinOT | Change |
|---|---|---|---|---|
| S1 | Header logo | Hexagon SVG plus a two-line wordmark ("ALLIANCE / CODEX" at 10.9 and 9.3px, orange and white). | One logo image, 36px tall, no text lockup (§1.2). | One Alliance Codex logo image, 36px tall, using our own mark. Remove the tiny text. |
| S2 | Header search | Left-aligned trigger at x=124, 496x36. Placeholder "Busca Pokémon, items o quests" mixes languages. No `kbd`. | Centered 448x36, radius 12, "Buscar..." plus a `Ctrl + K` kbd (10px mono on #13161b). It opens the palette. Home has a full-width trigger in main and none in the header (§1.2, §2). | Centered trigger "Buscar..." with Ctrl + K opening the palette (§2.2). |
| S3 | Sidebar structure | Three flat groups ("Explorar", "Herramientas", "Comunidad") with 13 links. Every link has a 14px lucide icon. Groups do not collapse. "Herramientas" is both a group and a link, and "Buscar" is a nav link. The sidebar ends with a "Servidor / Server Save · 00:00 BR" block (11px, plus 10px mono). | "Home" link, a pinned "Destacados" group with 16px bouncing sprites, then collapsible accordion groups (16px chevron, 200ms) whose sub-links are text only on a 1px left rule. There is no footer block (§1.3). | Use the IA below. Remove all lucide icons from nav. Move Server Save to the home page. |
| S4 | Sidebar and main geometry | Sidebar content spans x 16–220. Main starts at x=264 and is 912px wide. | Sidebar 208px (x 0–208, 176px inner), a 40px gap, then main at x=248 (§1.1). | Match: 208 · 40 · 896 · 40 · 256. |
| S5 | Active nav | #22262f background. | No active state (a gap in RubinOT). | Keep it, and add `aria-current="page"`. |
| S6 | Right rail | None. At 1440, 264px of empty page sits on the right. Only /mapa/aportar has a "Resumen" TOC, and it sits inside the main column. | A 256px sticky rail with the "Resumen" TOC (12px, decimal list) on pages that have sections (§1.5). | Add the rail with the TOC. Put nothing else there: no promo and no status. |
| S7 | Breadcrumbs | "Inicio / Pokédex" with "/" separators. Parent crumbs are bright and the current crumb is gray, the inverse of RubinOT. | 14px chevron-right separators. Parents are #85888e and the current crumb is #f7f7f7. The first crumb is the sidebar group name (§4.1). | "Pokémon › Pokédex", "Herramientas › Guild", and so on. |
| S8 | Title block | A 30px h1 (correct). A 14px description sits between the h1 and the divider, capped near 620px and ragged. | h1, an optional 18px parenthetical, and a divider 8px under the h1. Any intro comes after a 48px gap, at 14/22, justified, full width (§4.2, §4.4). | Match. Most current descriptions are meta text and should be deleted (see each page). |
| S9 | h2 counts | 11px mono count to the right of the h2 (for example "Misiones … 1"). | Counts appear only in index-panel headers (§3.1). | Remove the counts from h2. |
| S10 | Footer | None on any page. | A slim bar: border-top, 16px padding, 10–12px #94979c (§1.6). | "Alliance Codex es un proyecto comunitario independiente, no afiliado a PokeAlliance." on every page, home included. The brief requires it (D6). |
| S11 | Mobile (390) | The header shows only the logo mark and the language select. Nav is an inline `<details>` block, "Navegación principal", that pushes content down and lists 13 links flat. There is no theme toggle and no search icon. | Header: logo, search icon, theme toggle and hamburger. Nav is a 288px sheet from the right with a black/80 blur overlay, the language select inside it, and the same groups as desktop (§1.4, §7). | Match. |
| S12 | Type scale | Measured sizes on the Spanish pages: 9.0, 9.1, 9.3, 9.4, 9.6, 9.8, 9.9, 10.0, 10.1, 10.2, 10.4, 10.6, 10.7, 10.9, 11.0, 11.2, 11.5, 11.7, 11.8, 12.0, 12.2, 12.3, 12.5, 12.8, 13.1, 13.4, 13.6, 14.0, 14.1, 16.0, 16.8, 17.3, 17.6, 18.0, 20.0, 21.6, 24.0, 24.5, 30.0, 32.0, 36.8, 42.4, 48.0, 49.0 and 72.0px. | 10, 11, 12, 14, 16, 18, 20 and 30 only, in two weights (§0 type table). | Snap to the RubinOT scale. Keep the local stack "Verdana, DejaVu Sans, Tahoma" and do not self-host Verdana. |
| S13 | Mono | Cascadia Mono for labels, IDs, counts, dates and tier boxes. | Mono only in `kbd`. | Remove mono everywhere except `kbd` and literal in-game commands. |
| S14 | Eyebrows | Uppercase tracked kickers over almost every block. Captured examples: "ALLIANCE CODEX", "ARCHIVO DE CAMPO", "POKÉDEX", "NORMAL", "SHINY", "QUEST", "CITY · KANTO", "TRAINING_CHARGER", "AVAILABILITY_SCOPE", "AFIRMACIÓN ACTUAL", "COMPARACIÓN DIRECTA", "SIN ENTRADAS TODAVÍA", "COMUNIDAD", "BORRADOR LOCAL", "LÍMITE ACTUAL", and "POKÉMON" 60 times in search. | "DESTACADOS" is the only uppercase label (§8). | Remove them all. |
| S15 | Surfaces | Cards are #070e15, darker than the page, which inverts the depth order. Hero panels are #3d1410, #cc3e38/#5a1110, #521e06 and #2b1c3b, and cards are tinted by type (#0f3312 grass). Comercio panels are #252a2e/#282d2e. Some borders are colored (orange on Charizard). Radius is about 16px. | Transparent bodies with 1px #22262f borders. #13161b for header strips and notes, #22262f for table heads and chips. Radius 12 for cards, 8 for tables, 11 for controls. No colored surfaces except the red info banner and tier fills (§0, §8). | Match. |
| S16 | Accent and buttons | Gold filled CTAs (#efb055: "Explorar Pokédex", "Importar", "Copiar anuncio"). Red filled segmented selection ("Todas las variantes"). Orange and navy selected chips. White pill buttons. | No brand accent. Buttons are h-9, radius 11, with a 1px #373a41 border. Selection is either amber #d97706 (border plus ring) or a tier fill (§4.10, §6). | Match. Remove every gold and red fill. |
| S17 | Decoration | Concentric rings behind the artwork, Poké Ball watermarks on the bands and cards, the "Pokédex device" lens with three lights, a gold bar under the hero CTA, and a quarter-circle arc on detail pages. | None (§8). | Delete all of it. |
| S18 | Imagery | Official artwork hotlinked from `https://wiki.pokealliance.com/pokemon/<n>.png`, at about 150px on cards and about 300px on detail and home. | Small game sprites at 16/24/32/48/64/128 (§5). | Use in-game pixel sprites from the registry at integer scale with `image-rendering: pixelated`. Artwork appears at most as a content image on detail pages (D2). |
| S19 | Iconography | Lucide icons in the nav (home, book, sparkles, shield, swords, wrench, users, map, search), in the home cards, and in the guild tool (file-json, calendar, cloud, sliders). The ✦ glyph marks Shiny. | Lucide is limited to utility glyphs (search, chevrons, globe, moon/sun, menu, x, arrows, info, check). Every nav entry, card, panel, chip, timeline node and tab uses a sprite (§8). | Match. Replace the ✦ with the game's Shiny icon (the blue marker at top-right in `1.png`). |
| S20 | Tooltip | None. Entity names are plain text or plain links. | An inverted white pill (§4.14). We replace it. | Show the in-game tooltip on every entity mention (§2 below). |
| S21 | Entity views | The Pokédex has only a card grid. Tiers and search have only a list. | Tables (§4.11), loot rows (§4.13) and a detail head (§4.17). | Add a Cards · Slots · Lista switch to every entity list (§2). |
| S22 | Language | English data strings inside /es: quest steps, rewards, item, move and assertion text. Raw keys (`TRAINING_CHARGER`, `AVAILABILITY_SCOPE`, `excludedScopes`, `compatibilityCondition`, `amount: 12 · unit: second`, `pending_review`, `spawn_area`, `training_charger`, `icon`, `flagId`) and lowercase codes ("normal", "shiny", "city", "grass · poison"). | Clean localized labels. | Spanish UI throughout. Keep canonical English only for game terms: Boost, Held Items, Star Machine, Linked Tasks, Memory Slots, Shiny, tiers and NPC names. |
| S23 | Required level | "NIVEL / 80" split in a stat grid, "Nivel requerido 200", "Nivel mostrado 1", "Lv. 120", and a "Level" field. | n/a | Always the single string "Nivel 120" in Spanish and "Level 120" in English: in tooltip rows, cards, table cells, chips and banners. |
| S24 | Numbers | Spanish data text uses comma thousands ("5,000,000 experience", "Adds 20,000", "1,500,000"). The guild tool uses dots ("1.300"). | n/a | Format with `Intl.NumberFormat(locale)`: "1.500.000" in Spanish. Keep game shorthands ("1500k") as the game writes them. |
| S25 | Focus | A visible indigo ring, seen in the import dialog. | #444ce7 outline, suppressed on inputs (a gap in RubinOT). | Keep the visible focus on inputs too. |
| S26 | Motion | None of RubinOT's. | A 5s, 3px bounce on Destacados sprites, a 2px arrow nudge on card hover, 150ms color changes, and 150ms dialog and tooltip entry (§0, §5). | Match. The only other motion is sprite-sheet animation, with reduced-motion support. |

**Target IA (sidebar and home index panels).** A link appears only when its page has real content: no disabled or "próximamente" entries.

```
Inicio
Destacados (pinned, 16px sprites): Pokédex · Comercio · Guild · Mapa
Pokémon: Pokédex · Tiers · Comparar Pokémon
Sistemas: Entrenamiento · Server Save · (Boost, Held Items, Star Machine, Linked Tasks, Memory Slots, Auras: each only once sourced)
Ítems: Balls · Stones · Diamonds · Chargers (as item data lands)
Guías: Porygon Quest · Saffron
Herramientas: Mapa · Comparar Pokémon · Guild
Comunidad: Comercio · Cambios · Aportar al mapa
```

Sub-links stay text-only, as in RubinOT. Sprites appear on Destacados, index panels and cards. Either way, no generic SVG icons appear in navigation.

---

## 2. Shared components to build

| Component | RubinOT source | PokeAlliance specifics |
|---|---|---|
| `Sprite` | §5 | Resolves a registry id to its source and natural size. Renders at integer scale (1x, 2x or 4x) with `image-rendering: pixelated`. Uses the 300ms fade-in and pulse placeholder. |
| `SpriteSheet` | §5 sprite-sheet CSS module | Two modes on a horizontal strip.<br>**`frame`:** a fixed variant chosen by parameter. Stackable quantity thresholds 1, 2, 3, 4, 5, 10, 25 and 100 map to the 8 frames of `public/images/sheet_alliance_ball.png` (256x32).<br>**`animate`:** plays like a gif with per-frame durations, as in `sheet_diamond.png` (224x32, 7 frames). Needs generated keyframes with per-frame percentages, or a small stepper. Frame 0 under reduced motion.<br>Other sheets: premier and ultra balls (5 frames each), and fire, heart, leaf, thunder and water stones (8 frames each). |
| `GameTooltip` | Trigger mechanics from §4.14. Visuals from `images/1.png` | **Panel:** about #20252c (sampled #21252c and #20252c), footer strip #1d232b, radius 4–6. The gold bar track is #262b32.<br>**Rows:** gold labels #E8C66A on the left, white values on the right.<br>**Header:** sprite, the ball icon at top-right, and the Shiny marker. Name in the game's letter-spaced caps.<br>**Collapsible sections:** "Held Items: 2" with 32px item slots, each opening its own nested tooltip. "Entrenamiento: 1" with a compact gold bar (#E8C66A), e.g. "Attack 16 (53%)".<br>**Footer:** "Mantén Shift para fijar".<br>**Behavior:** hover or focus, side top, 150ms fade plus zoom from 95%. Shift pins it. Esc or blur closes it.<br>**Modes:** *species* (Pokédex facts) and *unit* (one Pokémon: Nivel, Aura, Boost, Nickname, Memory Slots, Star Level, NPC Price, Held Items, Entrenamiento). |
| `EntityLink` | §4.4 `text-link` | #93c5fd, underlined on hover, with an optional 16px inline sprite. It is the tooltip trigger and is used in prose, table cells and chips, but not in breadcrumbs. |
| `ViewSwitch` | §4.10 content toggle | Three bordered buttons, "Cards · Slots · Lista". Selected state is amber #d97706 border plus ring, with `aria-pressed`. The choice is remembered per list in try/catch `localStorage`. |
| `EntityCard` (Cards) | §4.17 head block in a `rounded-xl border` card | 64px sprite, 14px bold name, then the `GameTooltip` body rendered inline. The card opens no tooltip, but nested entities (Held Items, ball, drops) open their own. |
| `SlotGrid` (Slots) | §4.13 loot box | A `rounded-xl` #13161b container holding 32px sprites in 40px `rounded-lg` slots (slot background #0c0e12, 1px #22262f), plus a 12px group label. Hover or focus opens the tooltip. |
| `EntityTable` (Lista) | §4.11 | 8px-radius wrapper, 32px #22262f head row, centered cells with vertical dividers, 56px rows (40px compact). No zebra striping and no row hover. The sprite cell is 48px. The entity cell is an `EntityLink`, so hovering it opens the tooltip. |
| `TypeChip` | §4.7 chip | `rounded-full` #22262f, 24px tall, 12px text, with the element icon at 16px when one exists (D4). |
| `IndexPanel`, `DestacadoCard`, `InfoBanner`, `InfoCard`, `Timeline`, `SegmentedTabs`, `Note`, `StatCard`/`Counter`, `RelatedIndexBox`, `Palette`, `Footer`, `TocRail` | §3.1, §3 item 3, §4.5, §4.6, §4.7, §4.10, §4.12, §4.16, §4.17, §2.2, §1.6, §1.5 | Copy their anatomy 1:1 with PokeAlliance sprites. |

---

## 3. Page by page

### 3.1 Inicio `/es/`

**Now**
- **Landing hero card**, 912x405 at y=96:
  - Left panel (#050c13): the gold 11px eyebrow "ALLIANCE CODEX", then a 49px h1 over three lines, "Encuentra lo que necesitas para jugar.".
  - A 44px search field with Ctrl K.
  - A gold CTA "Explorar Pokédex ↗" (#efb055) and a decorative gold bar, about 72x8.
  - Right panel (maroon, #3d1410): a mono header "POKÉDEX DE POKEALLIANCE / Ver todos los Pokémon ↗", then three official artworks of about 130px (Bulbasaur, Charmander, Squirtle) inside concentric rings.
- **"Explorar la wiki"**: a 2x2 grid of 450x90 cards on #070e15. Each has a 22px gold lucide icon, a 13px title, an 11.2px description and a ↗ arrow. The cards are Pokédex, Mapa, Guías and Herramientas.
- **"Server Save" card**, 431x165:
  - A green tag reading "Temporal".
  - "Hora canónica convertida a tu zona".
  - Mono "2026-09-17 · 21:00".
  - "Tu fecha local: America/Mexico_City".
  - Mono "00:00 · America/Sao_Paulo".
- No footer.

**Differences**
- **Hero, slogan, eyebrow, CTA and decorative bar:** RubinOT's home opens with a 16px h1 and a one-line 12px description next to the logo (§3 item 1, §8).
- **Starter artwork:** it is decoration, not navigation. RubinOT home imagery consists of 24–32px sprites inside panels and cards.
- **Search:** it is an input inside the hero. RubinOT uses a full-width 36px trigger that opens the palette (§2.1).
- **Link density:** the page carries 5 content links. The RubinOT home carries about 50 in its index panels (`3.webp`).
- **Cards:** 90px tall instead of 62, lucide icons instead of 32px bouncing sprites, and a description under each title where RubinOT shows only a 12px label.
- **Server Save card:** "Temporal" is the name of the JavaScript date API, and the IANA zone ids are developer text. The date is set in mono.
- **Layout:** the 944 + 208 home layout is not used. There is no index-panel grid and no live-data column.

**RubinOT-faithful version**
1. **Intro row.**
   - Logo at 112px, hidden below 576.
   - h1 16px bold "Alliance Codex".
   - One 12px #cecfd2 line: "Pokédex, ítems, sistemas, guías y herramientas de PokeAlliance."
   - On the right: social links only if the Codex has real channels (D7). Otherwise nothing.
2. **Search trigger.** Full width, 36px: "Buscar Pokémon, ítems, sistemas…" plus `Ctrl + K`. It opens the palette.
3. **DESTACADOS.** The 11px uppercase label, then 4 cards of 62px, each with a 32px sprite on the 5s bounce, a 12px label and a 12px arrow:
   - Pokédex: Alliance Ball.
   - Comercio: animated Diamond sheet.
   - Guild: sprite to be decided.
   - Mapa: sprite to be decided.
4. **Grid `lg:grid-cols-3`.** The left two columns hold index panels, each with a 45px #13161b header strip, a 24px sprite, a 12px bold title and an 11px link count, over two columns of 28px links with 16px sprites:
   - **Pokémon:** Generación 1–7, Shiny, Tiers, Comparar.
   - **Sistemas:** Entrenamiento, Server Save, and the rest once sourced.
   - **Ítems:** Balls, Stones, Diamonds, Chargers.
   - **Guías:** Porygon Quest, Saffron.
   - **Comunidad:** Comercio, Cambios, Aportar al mapa.

   The right column takes the slot of RubinOT's worlds table:
   - A **Server Save** panel: a header strip with a sprite, then two rows, "Hora del servidor · 00:00 (Brasil)" and "Tu hora · 21:00".
   - A countdown to the next save: tabular digits with 12px units (§4.16 counter).
   - Below it, once Cambios has entries, a small "Cambios" table (date · title).
5. **Footer** with the required line.

**Data**
- Link counts come from the IA.
- Generation counts come from `data/normalized/pokemon-roster.json`: 297, 219, 260, 111, 10, 11 and 2.
- The schedule comes from `data/research/game-operations.json`: daily at 00:00 America/Sao_Paulo.
- Sprites already public: `ball_alliance_ball.png`, `sheet_diamond.png`, and five outfits for generation links. The rest must come from the registry.

**Mobile**
- The logo image is hidden and the intro stacks.
- The header shows a search icon instead of the trigger.
- Destacados becomes one column of 358x62 cards.
- Panels go full width, with Server Save below them.

---

### 3.2 Pokédex `/es/pokedex/`

**Now**
- **Band.** A 912x216 red band (#cc3e38 left, #5a1110 right) holds:
  - a "device" lens with three colored lights;
  - the eyebrow "ARCHIVO DE CAMPO";
  - a 72px "Pokédex" title and the tagline "Encuentra una especie, reconoce su variante y abre su ficha.";
  - a decorative counter "REGISTRO POKEALLIANCE 910 ENTRADAS" over a Poké Ball watermark.
- **Filter box.**
  - A search input with a "/" key.
  - A red filled segmented control: "Todas las variantes / Normal / Shiny".
  - Three selects: generación, tipos and orden.
  - A lucide sliders icon, then mono "910" and "Pokémon encontrados".
- **Grid.** 4 columns of 217x262 cards. Each card has:
  - a 160px art panel tinted by type, with a Poké Ball watermark;
  - mono "#001", a 13px name and a mono tier box "T6";
  - 9.4px mono "PVE" and "NORMAL/SHINY";
  - colored type pills;
  - a ✦ in a circle for Shiny;
  - a 44px inset of the in-game sprite, only for the 4 Pokémon with public outfits.
- **Pagination.** "Mostrar más Pokémon · 48 / 910". In the full-page capture, 20 of the 48 grid cells render as empty boxes.

**Differences**
- **Band:** a hero band, a 72px title, a tagline, an eyebrow and a decorative counter. The lens and lights are a remnant of the rejected "Pokédex device" direction.
- **Cards:** colored, artwork-first, and use mono labels. RubinOT category pages are sectioned tables with 48px sprites (§4.11).
- **Controls:** filters sit in a bordered box, and the segmented control has a red fill instead of amber selection.
- **Missing:** no sections, no TOC, no Lista or Slots view, and no tooltip.
- **Pagination:** it hides entries from Ctrl+F and from the TOC. RubinOT lists render in full.

**RubinOT-faithful version**
1. **Title.** Breadcrumb "Pokémon › Pokédex". h1 "Pokédex" plus the divider.
2. **Intro.** One factual 14px line: "910 variantes: 526 normales y 384 Shiny, generaciones 1 a 7."
3. **Toolbar.** One row inside 896px:
   - search h-9 ("Nombre o número");
   - Radix selects for Generación, Tipo and Tier (listbox #22262f);
   - a segmented control Todas / Normal / Shiny with amber selection;
   - `ViewSwitch` on the right;
   - a result count as 12px #94979c text, with no icon.
4. **Sections.** An h2 per generation, "Generación 1" to "Generación 7" (anchors `#gen-1`…), mirrored in the rail TOC. Each section renders in the chosen view:
   - **Lista:** columns sprite 48 | Nº | Nombre (`EntityLink`) | Tipos (`TypeChip`) | Tier | Nivel ("Nivel 80") | Variante (Shiny marker). Hovering the name opens the species tooltip.
   - **Cards:** 4 across at 896 (about 212px each). Each `EntityCard` has a 64px sprite and the species rows: "Nivel 80", Tier T3, Tipos, Generación 1, Rol PVE, and the Shiny marker. The card opens no tooltip.
   - **Slots:** a `SlotGrid` per generation, about 20 slots per row, so the whole Pokédex fits in about two screens. The tooltip opens on hover or focus.
5. **Rendering.** No pagination. Render all 910 entries statically, with `content-visibility: auto` per section.

**Data**
- `data/normalized/pokemon-roster.json` holds 910 records with fields generation, level, variant, elements, image, detailAvailable, tier and function.
- **Tiers:**
  - T1 88, T2 131, T3 110, T4 148, T5 159, T6 84, T7 18.
  - Super Rare 24, Ultra Rare 14, Legendary 12, Mythic 3, ULTIMATE 27.
  - 92 have no tier; show "—".
- **Sprites:** `public/images/outfits/manifest.json` lists bulbasaur (2), charmander (5), charizard (7), shiny-charizard (509) and squirtle (8). The fallback for the other 905 is decision D1.

**Mobile**
- Lista scrolls horizontally with fixed minimum widths.
- Cards use 1–2 columns, and Slots wrap.
- Filters stack. The view switch stays visible.

---

### 3.3 Pokémon detail: Charizard `/es/pokedex/charizard/`

**Now**
- **Hero card**, 912x502, with a 1px orange border:
  - Left, a 364px brown panel (#521e06): mono "#006" and a roughly 280px official artwork inside rings and an arc.
  - Right: the eyebrow "POKÉDEX", a 72px "Charizard", and colored Fire and Flying pills.
  - A 2x2 stat grid with mono uppercase labels: TIER T3, ROL PVE, NIVEL 80, GENERACIÓN 1.
  - A "VARIANTES" row: Normal (orange, selected) and ✦ Shiny.
- **Outfit card**, orange-bordered:
  - A 270x280 black box labeled "OUTFIT DEL JUEGO · #7", with the 64px outfit scaled about 2.7x, which is not an integer.
  - "DIRECCIÓN" buttons Sur / Oeste / Norte / Este, with a navy selected state.
  - "AURA": three 54px circular ball sprites with colored rings.
- **"NORMAL / Datos de la ficha"**: shows "6 campos" but no rows.
- **Prev/next**: mono "← ANTERIOR / Shiny Charmeleon", a "Volver a la Pokédex" button, and "SIGUIENTE → / Shiny Charizard".

**Differences**
- **Head:** RubinOT's detail head is a 64px sprite, a 14px bold name and 12px stat lines, followed by 14px bold-key rows (§4.17). Here it is a hero with a 72px title, a colored border, artwork and a mono stat grid.
- **Internal id:** the outfit id ("#7") leaks into the UI.
- **Selectors:** direction and aura are bespoke controls. They should be segmented selectors (§4.10) with sprites and amber selection.
- **Empty section:** the "Datos de la ficha" card renders no data.
- **Prev/next:** mono labels plus a button. RubinOT uses a related index box with sprites (§4.17).
- **Width:** main is 912. The detail template drops the rail and uses a 1192px main with a 24px rhythm.

**RubinOT-faithful version** (detail template, no rail)
1. **Title.** Breadcrumb "Pokémon › Pokédex › Charizard". h1 "Charizard" plus the divider.
2. **Head block.**
   - The outfit sprite at 128 (64 natural at 2x), south idle.
   - The name, 14px bold.
   - The species tooltip rows inline: "Nivel 80", Tier T3, Tipos (Fire and Flying chips), Rol PVE, Generación 1.

   This block is the tooltip content, so the Pokémon itself opens no tooltip here.
3. **Segmented selectors.**
   - **Variante:** Normal | Shiny, with each variant's 32px sprite. Each is a link to its own page.
   - **Dirección:** Sur / Oeste / Norte / Este, each showing its facing sprite.
   - **Aura:** one 48px sprite per option, with amber selection and `aria-pressed`.
   - Changing a selector re-renders the head sprite.
4. **Key/value rows** (bold key, 14px), each only when data exists:
   - "Evoluciona de:"
   - "Evoluciona a:"
   - "Movimientos:"
   - "Aparece en:"
   - "Drops:"

   Today none of them have data, so all are omitted.
5. **`RelatedIndexBox`.** The evolution line (Charmander · Charmeleon · Charizard · Shiny Charizard) with 32px sprites, plus the previous and next entries.
6. **Footer.**

**Data**
- The roster record: level 80, tier 3, elements fire and flying, generation 1.
- The outfit manifest: id 7, 64x64, 4 directions, public idle PNGs.
- Aura options use `ball_alliance_ball.png`, `ball_premier_ball.png` and `ball_ultra_ball.png`.
- Evolution line: not in the data yet.

**Mobile**
- The head stays a row (64px sprite plus text).
- Tabs use 2 columns, and the related box goes full width.

---

### 3.4 Pokémon detail: Shiny Ditto `/es/pokedex/shiny-ditto/`

**Now**
- Same hero template on a beige panel, with the official art of a gray Ditto.
- The single type pill "Normal" sits next to the variant buttons "Normal / ✦ Shiny": the same word with two meanings.
- Stats: T7 · PVE · NIVEL 1 · GENERACIÓN 1.
- No outfit section, because there is no public outfit.
- An empty "SHINY / Datos de la ficha · 6 campos".
- Prev "Ditto", next "Eevee".

**Differences**
- Everything listed in 3.3.
- **Ambiguity:** "Normal" is both the type and a variant.
- **Sprite:** missing.
- **Shiny marker:** the ✦ glyph instead of the game's icon.
- **Memory Slots:** no data, yet the owner's in-game tooltip for a Shiny Ditto shows "Memory Slots: 6", and the Comercio form already models 1–6 slots.

**RubinOT-faithful version**
- Same template as 3.3.
- The type is shown as a `TypeChip` and the variants as sprite tabs with the Shiny marker, which removes the "Normal / Normal" clash.
- Add an h2 "Memory Slots" (canonical term) only once it is sourced. Today the only evidence is one observation, `images/1.png`.
- The unit in that screenshot is the reference fixture for the tooltip's unit mode:

  | Field | Value |
  |---|---|
  | Required level | Nivel 1 |
  | Aura | premier |
  | Boost | +20 |
  | Nickname | SUSANOO |
  | Memory Slots | 6 |
  | Star Level | 0 |
  | NPC Price | Unsellable |
  | Held Items | 2 |
  | Entrenamiento | Attack 16 (53%) |

**Data**
- Roster: tier 7, level 1.
- Sprite: absent from the public set; check the private dump (D1).

---

### 3.5 Guías `/es/guias/`

**Now**
- h1 "Guías" and the meta line "Misiones, recompensas y rutas disponibles en el archivo.".
- **h2 "Misiones"** (count 1): a purple hero (#2b1c3b, 912x258).
  - The eyebrow "QUEST", a 36.8px title, and an English description.
  - A bordered pill "Nivel requerido 200".
  - The Porygon artwork in a circle.
  - Below it, two columns:
    - "Pasos": 6 mono numbered circles on a vertical line, with the steps in English.
    - "Recompensas": items with ✦ glyphs: "5,000,000 experience", "50 Empty Alliance Ball", "50 Empty Yume Ball", "4 Enhanced Normal Stone", "Permanent access to the Porygon-area computer".
- **h2 "Ubicaciones y viaje"** (count 1): a card with a green stripe and a lucide pin.
  - The eyebrow "CITY · KANTO", then "Saffron".
  - "Ruta de viaje" with ↗ bullets.
  - The raw text `mode: Teleport · command: h "saffron`, with an unbalanced quote.

**Differences**
- **Structure:** a full quest is rendered inline on an index page. RubinOT uses an index that links to a sub page.
- **Styling:** a hero, a 36.8px title, an eyebrow, artwork, a colored stripe and a lucide pin.
- **Language:** English content, and the level written as "Nivel requerido 200".
- **Rewards:** plain text with ✦ and no sprites, links, quantities or tooltips.
- **Steps:** mono circles. RubinOT's timeline (§4.7) uses 20px sprite nodes, a dashed 1px #373a41 line, 12px italic captions and chips.
- **Command:** a raw command string.

**RubinOT-faithful version**
- **`/guias` index.** Breadcrumb "Guías". h1 plus the divider. Two tables:
  - "Misiones": sprite | Misión (link) | Nivel | NPC | Recompensas (24px sprites with tooltips).
  - "Ubicaciones": Ciudad | Región | Acceso.
- **`/guias/porygon-quest`** (sub page with rail TOC):
  - **Title:** breadcrumb "Guías › Misiones › Porygon Quest". h1 "Porygon Quest" with the parenthetical "(Dr. Vektor)".
  - **Red info banner:** a 64x32 sprite slot and "Nivel 200 | NPC: Dr. Vektor | Recompensa permanente: acceso al ordenador del área Porygon".
  - **h2 "Pasos":** a timeline with one row per step.
    - Each row has a 20px node sprite (NPC, computer or Porygon), 14px step text, and chips for involved entities. For example "Giant Porygon" with its sprite, which opens a tooltip.
  - **h2 "Recompensas":** a table (Recompensa | Cantidad) or a loot row of 32px slots:
    - Alliance Ball x50 uses the "≥25" frame of `sheet_alliance_ball.png`.
    - Yume Ball x50.
    - Enhanced Normal Stone x4.
    - "5.000.000 de experiencia" as a text chip.
  - **h2 "Ubicación":** only once a location is sourced. An OTMM floor crop plus coordinates.
- **`/guias/saffron`.**
  - Key/value rows: "Región: Kanto", "Tipo: Ciudad", and "Acceso: Teleport". The command `h "saffron"` goes in inline code, the only mono allowed besides `kbd`.
  - "NPC: Nurse Joy (Pokémon Center)" with a tooltip.
  - A map crop.

**Data**
- `data/normalized/quests.sample.json` (1 record) and `locations.sample.json` (1 record).
- Spanish translations are needed for the quest text (`knowledge/localization`).
- **Sprites:** the Alliance Ball sheet is public. Yume Ball, Enhanced Normal Stone, Porygon and Dr. Vektor are missing.

**Mobile**
- The timeline rail stays at 20px, and chips stack.
- Banner facts stack.

---

### 3.6 Sistemas `/es/sistemas/`

**Now**
- h1 plus "Consulta de forma directa qué hace cada objeto y cómo funciona cada movimiento.".
- **h2 "Objetos de sistema"** (count 1): a 447px card with the eyebrow "TRAINING_CHARGER", then "Normal charger", then the English "Adds 20,000 standard-progress charges to the Punching Bag".
- **h2 "Movimientos"** (count 1): a card with the eyebrow "PVE", then "Scratch".
  - Mono labels: ELEMENTO Normal · SLOT M1 · COOLDOWN "amount: 12 · unit: second".
- The right 465px of main is empty.

**Differences**
- **Content type:** these are an item record and a move record, not systems.
- **Leaks:** raw enum names and serialized JSON.
- **Layout:** half-width cards.
- **Missing:** no sprites and no per-system pages.
- **Language:** English content.

**RubinOT-faithful version**
- **Navigation.** "Sistemas" is a sidebar group and a home index panel. `/sistemas` stays only as a single `IndexPanel` (sprite plus name, 2 columns) so the breadcrumb crumb has a target.
- **One system page per system**, following the Battle Pass anatomy (§4):
  - breadcrumb, h1 with an optional parenthetical, and a justified intro;
  - then sections with info cards (§4.6), tables, notes and timelines;
  - canonical English names: "Star Machine", "Held Items", "Memory Slots", "Boost", "Linked Tasks".
- **Entrenamiento** (sourced):
  - "Atributos" table: Atributo | Nivel | Progreso, for Attack, Critical Damage, Critical Chance, Critical Resistance, Defense, HP, Precision and Evasion, as shown in `images/2.png`.
  - "Cargadores" table: charger items with sprite and tooltip, e.g. "Normal charger · 20.000 cargas", which feed the Punching Bag.
- **Other systems** (Boost, Held Items, Star Machine, Memory Slots, Linked Tasks, Auras): a page exists only once the system is sourced.
- **Moves.** They move to a "Movimientos" table under Pokémon: Nombre | Elemento | Slot | Cooldown ("12 s").

**Data**
- `items.sample.json` (1), `moves.sample.json` (1).
- `images/2.png`.
- `normalized/terminology.json` (4 records).
- `research/domain-inventory.json` declares the system, progression and activity domains, with no records.

---

### 3.7 Rotaciones `/es/rotaciones/`

**Now**
- h1 "Rotaciones y tiers" plus the meta line "Las categorías del juego se muestran como afirmaciones de guía, no como hechos universales del canon Pokémon.".
- One card:
  - the eyebrow "AVAILABILITY_SCOPE";
  - the title "Special Shiny tiers — Primal Area availability";
  - "AFIRMACIÓN ACTUAL", with an English sentence at 18px;
  - "CONTEXTO", with raw `excludedScopes` and `compatibilityCondition` text;
  - "CONJUNTO COMPARADO".

**Differences**
- **Copy:** epistemic meta text instead of content.
- **Leaks:** raw keys and English.
- **Missing:** no tier content at all, although the roster carries tiers for 818 variants.

**RubinOT-faithful version** (page "Tiers", breadcrumb "Pokémon › Tiers")
1. h1 "Tiers" plus the divider.
2. **`SegmentedTabs`:** T1–T7, Super Rare, Ultra Rare, Legendary, Mythic and ULTIMATE.
   - Each tab has a 32px tier icon and a count.
   - The selected tab is filled with the tier color if the game defines one (D5), as RubinOT does with bronze #8B4513.
3. **Selected tier:** an h2 "Tier 3", the `ViewSwitch`, and a Cards / Slots / Lista list filtered from the roster.
4. **h2 "Shiny especiales":** a `Note` (Inter italic on #13161b): "**Observación:** las variantes Shiny Ultra Rare, Legendary y Mythic aparecen de forma natural solo en Primal Areas compatibles; no en respawns comunes ni en Wildscape."
5. **h2 "Rotaciones":** only once dated rotation data exists, as a timeline (§4.7) or a season banner grid (§4.8).

**Data**
- Roster tiers.
- `rotation-tier-assertions.sample.json` (1).

---

### 3.8 Cambios `/es/cambios/`

**Now**
- h1 plus the meta line "Historial conciso de actualizaciones importantes del juego y de la wiki.".
- An empty-state card: the eyebrow "SIN ENTRADAS TODAVÍA", a bold "El registro todavía no tiene entradas publicadas.", and the filler "Las novedades se incorporarán aquí cuando estén listas para consulta.".

**Differences**
- **Empty page:** it has no content but is linked from the nav. RubinOT does not ship empty pages.
- **Copy:** an eyebrow and filler text.

**RubinOT-faithful version**
- A timeline (§4.7) grouped by month, with an h2 per month such as "Septiembre 2026".
- Each row contains:
  - a 20px node sprite for the kind of change;
  - an italic 12px date: "Publicado el 04/09/26:";
  - a 14px title;
  - chips for affected entities (16px sprites, tooltips);
  - an optional bullet list;
  - a link to the source announcement.
- Hide the page from the nav until at least one reviewed entry exists. If someone reaches it anyway, show one line, "Sin entradas.", with no card and no eyebrow.

**Data**
- `data/research/launcher-feed-profile.json` profiles the launcher feed: 20 news items and 2 banners, updated 2026-09-04.
- Only metadata and headings are stored. The raw bodies stay in the ignored inbox, so entries need a reviewed importer.

---

### 3.9 Buscar `/es/buscar/`

**Now**
- h1 "Buscar en el Codex" plus a two-line meta description.
- An input plus a "Buscar" button, then mono "915 RESULTADOS".
- A flat list of all 915 rows. Each row has:
  - an uppercase category eyebrow ("POKÉMON" x60 on screen);
  - a 16px bold name;
  - a raw mono code (`training_charger`, `city`, `normal`, `shiny`);
  - English descriptions.
- A "Mostrar más" button.
- `?q=charizard`, `?q=zzzz` and no query render byte-identical pages, all unfiltered.

**Differences**
- **Model:** RubinOT has no search page. Search is the Ctrl+K palette (§2.2).
- **Rows:** eyebrows, raw codes, no sprites.
- **Empty query:** every record is dumped on an empty query.
- **Bug:** the `q` parameter is ignored.

**RubinOT-faithful version**
- **Palette (primary).** Opened from the header trigger, the home trigger, or Ctrl+K.
  - A 576px dialog with a 48px input.
  - Groups "Pokémon", "Ítems", "Sistemas", "Guías" and "Páginas", with 12px #cecfd2 headings.
  - 42px items: a 24px sprite, a 14px name, and a 12px #94979c fact ("Nivel 80 · T3").
  - The selected item gets #13161b. On desktop, the selected item's tooltip opens to the side of the panel.
  - Footer keycaps: "↑↓ para navegar | ↵ para abrir".
  - An empty query shows the Destacados group.
- **`/buscar?q=` (shareable fallback).**
  - h1 "Buscar" and an input prefilled from `q`.
  - Results grouped by an h2 per category, each group a Lista table (sprite 32 | Nombre | Dato), with the `ViewSwitch`.
  - Empty `q`: the input plus the Destacados cards only.
  - No results: one line, "Sin resultados para «zzzz».".

**Data**
- The index covers the roster (910) plus 5 sample records: item, move, quest, location, rotation.

---

### 3.10 Herramientas `/es/herramientas/`

**Now**
- h1 plus the meta line "Las herramientas forman parte del Codex. Cada una se habilitará cuando sus datos y límites estén suficientemente revisados.".
- **h2 "Disponible":**
  - one bordered card, "Búsqueda del Codex";
  - three table-like rows with statuses "Preview disponible", "Disponible" and "Disponible en local" (the last two in green).
- **h2 "Siguiente en la hoja de ruta":** three rows ("Rotaciones y equipos", "Buscador de hunts", "Calculadoras") with "Próximamente…" and "Siguiente en la hoja de ruta".

**Differences**
- **Fake entries:** roadmap and status text, and tools that do not exist.
- **Styling:** two different row styles, and no sprites.
- **Model:** RubinOT has no tools index. Its tools are sidebar entries.

**RubinOT-faithful version**
- "Herramientas" becomes a sidebar group plus a home index panel.
- If `/herramientas` stays as the breadcrumb target, it is a single `IndexPanel` listing Mapa, Comparar Pokémon and Guild: 16px sprites, 12px labels, no status words and no roadmap.

---

### 3.11 Guild `/es/herramientas/guild/`

**Now (empty)**
- h1 "Ranking de guild" plus "Importa cortes diarios; el ranking ajusta las metas a los días habilitados de cada miembro.".
- A 912x320 empty card:
  - a lucide file-json icon and a bold "Todavía no hay una guild cargada";
  - a 16px line: "Selecciona el JSON exportado por el cliente o pégalo en el campo anterior." (there is no field above);
  - a white "Importar" pill.

**Now (loaded)**
- **Summary strip:**
  - mono uppercase labels: CLASIFICACIÓN, SEMANA, CORTE, COBERTURA, GUARDADO;
  - truncated values "07/09/2026–1…" and "1 registro · 1 s…";
  - buttons: a gold "Importar", "Metas", "Cuenta" and download. They end at x≈1380, past the main edge at 1176.
- A "1 día registrado." callout with a left accent bar.
- **Underline tabs:** Clasificación / Actividad / Historial, with "America/Sao_Paulo" beside them.
- **Filter tiles:** Todos 3 · En meta 1 · Por debajo 2 · Sin meta 0.
- **Ranking table:**
  - mono 9px headers: #, NOMBRE, DAILIES, CONTRIBUCIÓN, TOTAL ↓, ÚLTIMO ACCESO;
  - colored left status bars per row, and a row hover;
  - rows like "Membro · Lv. 120".
- **Actividad tab:**
  - 4 tiles: NIVELES GANADOS +0, ALTAS Y REINGRESOS 0, BAJAS OBSERVADAS 0, CON ACCESO PENDIENTE 0;
  - two meta sentences.
- **Historial tab:** one row: "10/09/2026 · Día de control 4/7 · 6 dailies · 800 contribución · Base de semana · Ver JSON".
- **Import dialog, Metas sheet and Cuenta sheet:** they render in a sans that is not Verdana.
  - The import dialog uses a native select.
  - Metas edits normal and premium goals per day and per week.
  - Cuenta has an email and password login for a server backup.

**Differences**
- **Against the brief** (admin analytics by day and by week, trends, inactivity): only a weekly ranking exists. There is no per-day matrix, no week-over-week comparison, no trends and no inactivity list.
- **Against RubinOT's tool anatomy** (§4.16):
  - The toolbar overflows and values are truncated.
  - The gold CTA, mono labels and left accent bars are not part of the language, and neither is the row hover (RubinOT tables have none).
  - Tabs are underline style instead of segmented buttons.
  - Filter tiles should be segmented buttons.
  - Desktop sheets should be dialogs (§4.15), and the font does not match.
- **Level format:** "Lv. 120".

**RubinOT-faithful version** (tool page with rail TOC)
1. **Title.** Breadcrumb "Herramientas › Guild". h1 "Guild".
2. **Toolbar**, all inside 896px:
   - a guild select and a week select (Radix);
   - bordered buttons "Importar", "Metas" and "Exportar" (h-9, radius 11, no gold);
   - the timezone as 12px #94979c helper text.
3. **`StatCard` row**, 4 across. Values are computed, in tabular 18px bold with a 12px footnote:
   - "Miembros · 25";
   - "Dailies esta semana · 118", with a footnote "+12 vs semana anterior";
   - "Contribución esta semana";
   - "Inactivos ≥3 días · 4".
4. **h2 "Por día":** a compact table (40px rows) of members by day, Lun–Dom.
   - Each cell holds that day's dailies; a missing snapshot shows "—".
   - The first column is sticky, and a totals row closes the table.
5. **h2 "Por semana":** Semana | Dailies | Contribución | Miembros activos | Δ vs anterior.
6. **h2 "Tendencias":** this is a new component, since RubinOT has no charts. Keep it flat, with no gradients, and within the palette:
   - a per-member sparkline column (1px #cecfd2);
   - or daily-total bars on #22262f, with the selected day in amber #f59e0b.
7. **h2 "Inactividad":** Nombre | Rango | Nivel ("Nivel 120") | Último acceso | Días sin acceso | Dailies semana.
   - Sorted by last access, with a threshold select of 1, 3 or 7 days.
8. **h2 "Metas":**
   - segmented Todos / En meta / Por debajo / Sin meta, with amber selection;
   - a ranking table: #, Nombre, Rango, Nivel, Dailies, Contribución, Total, Meta.
9. **h2 "Importaciones":** a timeline (§4.7) of snapshots.
   - Each entry has an italic date and chips: "6 dailies", "800 contribución", "Base de semana".
   - Each entry has a "Ver JSON" link.
10. **Dialogs.** Importar, Metas and Cuenta become RubinOT double-border dialogs (§4.15), in Verdana.
11. **Empty state.** h1 plus toolbar, and one line: "Importa un export de guild para ver el análisis."

**Data**
- The guild export JSON has `exportedAt`, `guild` and `members[]` (name, level, dailiesCompleted, rank, status, contribution, lastLogin). The profiled export had 25 members; see `data/research/guild-export-profile.json`.
- Snapshots follow `data/schemas/guild-snapshot.schema.json` and are stored in the browser (`GuildPersistencePanel`). The account backup lives under `supabase/`.
- Day boundaries use the Server Save zone (America/Sao_Paulo).
- Rank names ("Membro", "Vice-Líder") are guild data and are shown as they are.

**Mobile**
- Stat cards in a 2x2 grid.
- Tables scroll horizontally.

---

### 3.12 Comparar Pokémon `/es/herramientas/pokemon/`

**Now**
- h1 plus the meta line "Una consulta rápida para leer el roster público en paralelo… no hay recomendaciones inventadas ni fórmulas ocultas.".
- Underline tabs: "Comparar" / "Explorar tiers".
- **Comparar tab:**
  - the eyebrow "COMPARACIÓN DIRECTA", an h2 "Elige dos variantes", and the meta line "Este resumen no calcula daño ni decide cuál Pokémon es mejor.";
  - a "FILTRAR OPCIONES" input and two native selects ("001 - Bulbasaur · Normal");
  - two summary cards: eyebrow NORMAL, name, mono #001, orange "T6";
  - "Resumen comparado": a table with mono headers and rows Número, Variante, Generación, "Nivel mostrado 1", Tier, Función, Elementos ("grass · poison") and "Ficha detallada · Disponible".
- **Explorar tiers tab:**
  - native selects with truncated labels ("Todas las funcione", "Todas las variante");
  - mono "910 RESULTADOS";
  - rows with lowercase elements and a "Usar en comparar" button on each.

**Differences**
- **Copy:** defensive meta text and eyebrows.
- **Controls:** native selects. RubinOT uses a Radix select (§4.16).
- **Content:** no sprites, mono text, and raw lowercase elements.
- **Level format:** "Nivel mostrado".
- **Duplication:** the tiers tab duplicates the Pokédex Lista view and its filters.

**RubinOT-faithful version**
1. Breadcrumb "Herramientas › Comparar Pokémon". h1 plus the divider.
2. Two comboboxes side by side, each a Radix select with cmdk filtering, 24px sprites and "Nº · Nombre · Variante" labels.
3. **One `EntityTable`** with vertical dividers:
   - The head row shows 48px sprites and `EntityLink`s for A and B.
   - Rows: Nivel ("Nivel 1" / "Nivel 80"), Tier, Rol, Tipos (chips), Generación, Variante.
   - Cells are centered, rows are 40px, and nothing is color-coded.
4. The URL holds the state: `?a=charizard&b=shiny-charizard`.
5. Remove "Explorar tiers". It lives on Tiers and in the Pokédex Lista view.

**Data**
- The roster.

---

### 3.13 Mapa `/es/mapa/`

**Now**
- Breadcrumb "Inicio / Herramientas / Mapa del cliente". h1 "Mapa del cliente".
- **Meta text:**
  - three lines, including "Esta primera vista representa la capa observada del cliente; todavía no es un mapa semántico completo del mundo.";
  - a link line: "Aportar al mapa · Formato para enviar observaciones sin publicarlas automáticamente. →".
- **Controls:**
  - floor buttons Piso 1 and 3–9, with an orange selected state, plus a search input;
  - chips: Todos / Fisherman / Pokemon Center / Poke Mart / Otro marcador del cliente.
- **"Capas" panel:** legend chips with colored dots and mono counts (65 visibles, 57, 44, 11, 3, 4).
- **Canvas** (626x520): the OTMM minimap (water #3300cc) with circle markers.
  - A "Mapa base" tag and a vertical mono axis label "y 128-5583".
  - A zoom box (− ◎ + 100%) whose "Cursor" readout is clipped ("1721, 215…").
  - ↑ and ↓ floor arrows, and the caption "Arrastra el mapa para explorar".
  - A footer: "65 marcadores / Marcadores disponibles".
- **Right "Coordenadas" panel:** after a selection it shows "Fisherman · Piso 7" and rows x 1721, y 2158, z 7, icon 7, flagId 1.
- **Callout:** a dashed "Límite de este preview" box that mentions OTMM and `Minimap.flags`.

**Differences**
- **Copy:** three pieces of meta text.
- **Leaks:** internal fields (`icon`, `flagId`, OTMM, `Minimap.flags`).
- **Legend and markers:** colored dots instead of sprites, and mono counts.
- **Selection styling:** orange instead of amber.
- **Map chrome:** a dashed callout and chrome floating over the map.
- **Bug:** the cursor readout is clipped.
- **Naming:** "Pokemon Center" and "Pokémon Center" are both used, and the page is "Mapa" in the sidebar but "Mapa del cliente" in the h1.

**RubinOT-faithful version** (system page, wide main)
1. Breadcrumb "Herramientas › Mapa". h1 "Mapa" plus the divider.
2. **Floor selector:** `SegmentedTabs` "Piso 1 … Piso 9", only for floors that have an image. Bordered #373a41, amber selection, `aria-pressed`.
3. **Legend** (§4.13 inline legend on #13161b):
   - 16px sprites for Pokémon Center, Poke Mart and Fisherman, with plain counts;
   - clicking one toggles the layer (checkbox semantics, amber when on).
4. **Map frame.**
   - A full-width canvas in a `rounded-xl` frame with a 4px #13161b mat, the same as the video embed (§4.9), rendered pixelated.
   - 32px icon buttons for zoom (radius 11, hover #22262f) in one corner.
   - Markers are 16px sprites.
   - Hovering or focusing a marker opens its tooltip (name, "Piso 7", coordinates). Clicking pins it.
5. **Selected marker:** key/value rows under the map, "Fisherman · Piso 7 · x 1721 · y 2158 · z 7", plus a copy-coordinates button.
6. **"Aportar al mapa":** a plain text link.

**Data**
- `public/data/map/otmm/floor-{1,3,4,5,6,7,8,9}.png`.
- `data/staging/local-minimap-flags.json` (119 flags) and `data/normalized/map-features.sample.json`.
- `data/reports/local-client-minimap-marker-inventory.json`.
- NPC and building sprites are missing.

**Mobile**
- The map goes full width (358px).
- Floors wrap 4 per row, and the legend wraps.
- Selected-marker rows sit below the map.

---

### 3.14 Aportar al mapa `/es/mapa/aportar/`

**Now**
- **Bullets:** "Qué se puede aportar".
- **Tables:** "Datos mínimos" and "Estados de revisión", with the second column right-aligned.
  - Raw values: `spawn_area`, `hunt_entrance`, `npc`, `quest_point` and `travel_point`, plus `pending_review`, `approved`, `rejected` and `stale` in mono.
- **"LÍMITE ACTUAL" card:** it says no submission exists yet, and gives the credentials warning.
- **TOC:** "Resumen" sits inside the main column at x≈968.
- A "Volver al mapa →" link.

**Differences**
- **TOC placement:** it belongs in the rail, not the main column.
- **Leaks:** raw codes and mono.
- **Table alignment:** right-aligned prose. RubinOT centers table cells, or left-aligns prose cells.
- **Copy:** an eyebrow card.
- **Dead flow:** the page documents a submission path that does not exist.

**RubinOT-faithful version** (guide page with rail TOC)
- **Sections:**
  - "Qué se puede aportar" (bullets).
  - "Datos necesarios": a table, Campo | Qué incluir, with the types in Spanish: Área de aparición, Entrada de hunt, NPC, Punto de misión, Punto de viaje.
  - "Revisión": a table, Estado | Significado: Pendiente, Aprobado, Rechazado, Desactualizado.
- **The credentials warning:** kept as an "**Importante:**" `Note`.
- **"Cómo enviarlo":** the real channel (D8). If there is none, the page leaves the nav.

**Data**
- The map-feature schema.

---

### 3.15 Comercio `/es/comercio/`

**Now**
- **Hero panel** (graphite #282d2e, 912x190): the eyebrow "COMUNIDAD", a 42.4px h1, the meta line "Prepara los datos de lo que quieres vender o comprar. Los anuncios públicos aún no están habilitados.", and a Poké Ball tile.
- **Status line:** a gold "Borrador local" pill with "Se compone en este navegador; aún no se publica ni guarda.".
- **Composer panel** (#252a2e), with gold 11px labels:
  - "Quiero": Vender / Comprar.
  - "¿Qué vas a comerciar?": tiles for Diamonds, KKs, Pokémon and Item. The sprites sit in dark tiles, and the selected tile gets a gold border.
  - A Pokémon search: "Busca en las 910 variantes del roster".
  - "Datos del Pokémon": Level, Boost, Ball, Nickname.
  - "Más atributos": Star level, Held X, Held Y, Addon, Aura, "Next boost chance (%)".
  - "Training skills": 8 stats, each with Lv. and %.
  - "Ditto Memory": "Slots totales" from 1 to 6, then "Memoria 1…".
  - "Precio pedido": a checkbox, "A convenir".
- **Preview panel:**
  - "BORRADOR LOCAL / Vista del anuncio" and the official artwork.
  - "VENDER / Ditto", then rows with gold labels and white values.
  - A gold "Copiar anuncio" button, a disclaimer, and a textarea holding the plain-text listing.

**Differences**
- **Against RubinOT:**
  - A separate palette: graphite panels with gold labels on every field, a remnant of the rejected blue-graphite, tooltip-everywhere direction.
  - A 42px h1, an eyebrow, a hero, and a meta pill line.
  - Tiles with a gold selection instead of `SegmentedTabs` with amber.
  - Field labels are gold 11px instead of 14px #f7f7f7 (§4.16).
  - Some labels are English although they are not canonical terms: "Level", "Training skills", "Next boost chance (%)". "Held X" and "Held Y" need their canonical in-game names.
- **Against the brief:**
  - There is no marketplace: no listings, search, filters, or Cards / Slots / Lista.
  - No real-money price. The only in-game price is "A convenir".
  - No seller contact channels and no reviews.
  - The output is text to copy.

**RubinOT-faithful version**
- **A. `/comercio` (marketplace)**
  - Breadcrumb "Comunidad › Comercio". h1 "Comercio" plus the divider.
  - **Red `InfoBanner`** with the Diamond sprite in the 64x32 slot. The facts reflect the owner's rule (RMT through verified contact channels, no payment gateway): "Pago y entrega entre jugadores, fuera de Alliance Codex | Contacto por canales verificados | Reseñas solo de transacciones registradas".
  - **Toolbar:**
    - Vender / Comprar segmented;
    - a category segmented with 32px sprites: Pokémon · Diamonds (animated sheet) · KK · Ítems;
    - search;
    - filters: tier, Shiny, minimum Nivel, minimum Boost, price range, currency;
    - sort: Recientes / Precio / Reputación;
    - the `ViewSwitch`.
  - **Lista:** sprite 48 | Anuncio (`EntityLink`, unit tooltip) | Datos | Precio | Precio en juego | Vendedor | Contacto (channel glyphs) | Publicado (12px date).
    - Datos: "Nivel 100 · Boost +20 · Held Items 2".
    - Precio: "US$ 12,00".
    - Precio en juego: "1500k KK" or "30 Diamonds".
    - Vendedor: name plus "★ 4,6 (12)".
  - **Cards:** an `EntityCard` whose body is the unit tooltip:
    - Nivel, Aura, Boost, Nickname, Memory Slots, Star Level, NPC Price;
    - Held Items slots, each with a nested tooltip;
    - gold Entrenamiento bars.

    Then a price block (real money plus in-game), a seller row (rating and review count), and a link to the listing.
  - **Slots:** 32px unit sprites. The tooltip shows the unit plus price and seller rows.
- **B. `/comercio/<id>` (listing detail, detail template)**
  - **Head block:** the full unit tooltip content.
  - **Key/value rows:** "Precio:", "Precio en juego:", "Vendedor:", "Publicado:", "Estado:".
  - **h2 "Contacto":** the channels (Email, Teléfono with country code, e.g. "+52 …", Discord, Twitch, and so on), each with its verification state.
  - **h2 "Reseñas":**
    - the average and count;
    - a list of 0–5 star reviews (amber #f59e0b), each tied to a registered transaction and dated;
    - no review without a transaction.
- **C. `/comercio/publicar` (form, world-transfer anatomy §4.16)**
  - The current composer fields, restyled: 14px labels, h-9 radius-11 inputs, Radix selects, number fields with steppers, and amber checkboxes.
  - **Sections (h2):**
    - "Qué vendes";
    - "Datos del Pokémon": Nivel, Boost, Ball (sprite select), Nickname, Held Items (item pickers with sprites), Aura, Star Level, Memory Slots (Ditto only), Entrenamiento (8 stats);
    - "Precio": real money (amount plus currency) and in-game (KK or Diamonds), or "A convenir";
    - "Contacto": channels, including the phone with country code.
  - **Preview:** a live `EntityCard`, the same component as the Cards view, sticky in the rail position.
- **D. `/comercio/vendedor/<id>`**
  - Reviews plus active listings (Lista).

**Data**
- **Missing:** nothing exists server-side yet: no listings, sellers, transactions or reviews. This needs auth plus listing, transaction and review tables; `supabase/` is present.
- **Exists:**
  - The client-side composer (`src/components/trade/TradeDesk.tsx`).
  - Public sprites: `sheet_diamond.png` (7 frames), `public/trade/sprites/kks.svg`, and the ball images.
- **Hotlinked:**
  - Pokémon artwork from `wiki.pokealliance.com/pokemon/<n>.png`.
  - One item image, `wiki.pokealliance.com/api/assets/evolution-items/38609.png`.

**Mobile**
- Lista scrolls horizontally.
- Cards use one column, and filters stack above the list.

---

### 3.16 404 `/es/no-existe/`

**Now**
- Astro's default 404 page: the Astro logo, an English "404: Not found", "Path: /es/no-existe/", a #1b1b1d background and system-ui.
- There is no shell, and no `src/pages/404.astro` exists.

**Differences**
- No shell, no language support, and a foreign brand.

**RubinOT-faithful version**
- The full shell, then an h1 "Página no encontrada" (English: "Page not found") plus the divider.
- One line: "No existe ninguna página en /es/no-existe/."
- The full-width search trigger, then the Destacados cards and the footer.

---

## 4. Data and asset gaps that block a faithful build

| Need | Exists today | Status |
|---|---|---|
| Pixel sprites for all 910 variants (nav, Lista, Slots, Cards, tooltip) | 5 public outfits (bulbasaur, charmander, charizard, shiny-charizard, squirtle; 4 directions, idle). 41 in `research-inbox/client-files/outfits-dump`, with redistribution rights not established. | Blocker (D1) |
| Item sprites (balls, stones, Held Items, chargers, rewards) | 13 public images: 3 balls, `credit_card.png`, `sprite-618466.png`, and sheets for the Alliance Ball (8 frames), Premier and Ultra (5 each), Diamond (7) and 5 stones (8 each). | Yume Ball, Enhanced stones, Held Items, chargers and NPC sprites are missing. |
| Per-frame durations for the Diamond sheet | — | Read from the client `.dat` animation phases. |
| Held Items, Boost, Star Machine, Linked Tasks, Memory Slots and Auras rules | No records (declared in `domain-inventory.json`) | System pages are blocked. |
| Evolutions, moves per Pokémon, spawns, drops, NPCs, hunts | Domains declared, no records | Detail rows stay omitted. |
| Quests, locations, items and moves | 1 each (samples), English | Expand and translate. |
| Changelog | Launcher feed profile (20 news items, headings only) | Needs an importer plus review. |
| Guild analytics | Export profile, snapshot schema, browser snapshots, account backup | Enough to build. Per-day views need daily imports. |
| Comercio | Client composer only | Needs a backend (auth, listings, transactions, reviews, verified channels). |

---

## 5. Decisions needed from the owner

- **D1. Sprite fallback.** What shows for a variant without a cleared pixel sprite?
  - The official PokeAlliance wiki artwork at 48px in Lista and Cards only.
  - The name only.
  - Waiting for the registry.

  The Slots view needs real sprites in every case.
- **D2. Artwork on detail pages.** Keep the official artwork as a secondary content image (§4.13 content image, no frame), or remove it.
- **D3. Tooltip font.**
  - A game-faithful semibold sans, confined to the tooltip panel.
  - Or Verdana, like the rest of the site.

  The owner rejected a game font applied everywhere, not necessarily inside the tooltip.
- **D4. Type chips.** Neutral #22262f chips with element icons (RubinOT), or type colors treated as content color.
- **D5. Tier colors and icons.** Does the client define them? RubinOT fills the selected tier with its tier color.
- **D6. Footer on the home page.** The brief's line is required, but RubinOT's home has no footer. Recommendation: put the footer on every page.
- **D7. External channels.** Is there a Codex Discord or any other channel for the intro row and sidebar? Without one, show nothing.
- **D8. "Aportar al mapa".** What is the real submission channel?

---

## 6. Bugs seen in the captures (fix regardless of the redesign)

1. `/es/buscar/?q=charizard`, `?q=zzzz` and no query render identical, unfiltered 915-result pages.
2. In the full-page Pokédex capture, 20 of the 48 grid cells render as empty boxes.
3. The guild toolbar overflows the main column: the buttons end at x≈1380, and the panel ends at 1176. Summary values are truncated.
4. The guild empty state points to "el campo anterior", which does not exist.
5. The import dialog and the Metas and Cuenta sheets render in a sans that is not Verdana. The import dialog uses a native select.
6. "Datos de la ficha · 6 campos" renders no fields, on both Charizard and Shiny Ditto.
7. The map cursor readout is clipped ("1721, 215…").
8. In the Comercio state captures, the skip link renders as a white bar above the header and pushes the page down.
9. Spanish number formatting uses commas (1,500,000 · 5,000,000 · 20,000), while the guild tool uses dots (1.300).
10. Several strings mix languages:
    - the header placeholder "Busca Pokémon, items o quests";
    - the Comercio labels "Level", "Training skills" and "Next boost chance (%)";
    - English quest, item, move and assertion text on Spanish pages.
11. The Saffron command has an unbalanced quote: `h "saffron`.
12. There is no custom 404 page (`src/pages/404.astro` is missing).
13. In "Explorar tiers", the native selects truncate their labels ("Todas las funcione", "Todas las variante").
14. Names differ for the same page:
    - "Mapa" in the sidebar, "Mapa del cliente" in the h1;
    - "Comparar Pokémon y tiers" on /herramientas, "Comparar Pokémon" elsewhere;
    - "Pokemon Center" and "Pokémon Center".
