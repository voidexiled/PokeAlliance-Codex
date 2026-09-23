# Card and grid system

System name: **fixed-anatomy grids**. Every grid holds one card type; every card of a type has the same zones in the same order; the zones sit on shared row tracks (CSS subgrid), so the cards in a row share one height and every zone starts at the same y.

Design board: `Tarjetas.dc.html` ("Tarjetas y rejillas", 1440 x 10749). Board primitives: the card block at the end of `canvas-v2/gen/common.py` (section 15). Visual tokens: `RUBINOT_DESIGN_REFERENCE.md`.

---

## 1. Problem

Every card grid used `display: grid; align-items: start` with content-height cards, so rows were ragged:

| Grid | Tallest minus shortest card in a row |
|---|---|
| Comercio, Cards | 291.5 px and 22 px |
| Shiny Charizard drops, Cards | 22 px and 44 px |
| Componentes, Pokédex sample (one card with drops) | 130 px |

Comercio "Todo" mixes four asset types whose content differs by a factor of 2 to 3, so equal heights alone would leave 222 to 310 px of empty space in the small cards.

The in-game money also had the wrong name: it is **Pokédólares** (English UI: **Pokédollars**), counted in k and kk, and its sprite is `credit-card.png`.

## 2. Decision

**Fixed anatomy + subgrid, one card type per grid.** Comercio "Todo" is split into one grid per asset type.

Why this system:

- **Alignment comes from CSS layout.** No build-time measuring, packing or height estimation. It stays correct with English strings (about 30% longer), fallback fonts, text zoom and WCAG 1.4.12 text spacing. With the 1.4.12 overrides on the board's 48 cards: 0 spill, 0 row overlap, row spread 0.
- **DOM order is the sort order**, and visual order is row-major. Tab order and screen-reader order follow the sort.
- **Zones line up across a row.** Prices, sellers and drops sit at the same y, so players can compare cards sideways.
- **Browser support.** Subgrid works in Chrome and Edge 117+, Firefox 71+ and Safari 16+ (93.48% global usage, caniuse, September 2026). Older engines get one `@supports` fallback (5.5) that keeps equal heights per row.

Rejected:

- **Masonry** (grid-lanes, precomputed). Most browsers need the fallback, and that fallback places cards with heights computed at build time from Verdana metrics. The stress test broke it with +30% text width (gaps grew from 16 to 73.6 px) and with the Arial fallback on Android. It also leaves near misses of 22 to 28 px on low-variance grids and ragged bottoms of 102 to 247 px, and cards can't be compared sideways.
- **Size classes (bento).** Zone heights are fixed pixels, so text spacing overflowed zones: the nickname overlapped its label and the training meter crossed the card border. A packer reorders listings: Charizard moved from 2nd to 4th in "Recientes".

### 2.1 Comercio "Todo": options evaluated

All three options were built with the stress listings at 1440 (main 944, 3 columns of 304 px):

| Option | Result |
|---|---|
| **1. One grid per asset type** (chosen) | Every row has spread 0 and no hollow space beyond the padding. Row heights: Pokémon 657, Items 371, Diamonds 327. Cards keep their full content, and the sort order is kept inside each type. |
| 2. One shared summary anatomy (3 key rows + footer for every type) | Cards are uniform (351 / 327 px), but Pokémon lose 7 of their 10 facts, held items and training. The Pokédólares card needs 2 rows of "—". A card would no longer show its tooltip content, which breaks the three-view rule. |
| 3. Wide cards for rich Pokémon, order kept (no `dense`) | Row 1 leaves an empty cell. The item cards next to a wide card carry empty Held Items and Entrenamiento bands of about 110 px, because every card in a row must span the same tracks. |

**The rule:** "Todo" shows one titled group per asset type, in the fixed order **Pokémon, Items, Diamonds, Pokédólares**. This is the same order as the Slots view and the type tabs. A type with no results in the current page is left out. Inside a group, cards follow the chosen sort ("Recientes", or price ascending within each currency in the order R$, US$, MX$, Pokédólares, Diamonds, with no conversion). Pagination applies to the whole result set first; the page is then grouped. A type tab shows a single grid with no group heading.

## 3. Page columns

| Page | 1440 | 1280 | 1024 | 768 | 390 |
|---|---|---|---|---|---|
| With right rail (Pokémon detail, systems) | main 896 | 736 | 992 (no rail) | 736 | 358 |
| Without right rail (Comercio, Pokédex, Guild, home) | main **944** | 784 | 992 | 736 | 358 |

A page without a rail keeps an empty 208 px spacer where the rail would be, as the RubinOT home does: 1440 − 208 sidebar − 40 − 40 − 208 = 944. Every block of the page, including banners, filters, toolbars, charts and grids, ends at x = 1192. The sidebar and the header don't change. Below 1280 the sidebar, rail and spacer are hidden, and the content has 16 px side gutters. On the boards, pass `RAIL_SPACER` as `rail_html` to `page()`.

## 4. Grid rules

1. **One card type per grid.** Never mix card families or listing types in one grid.
2. `display: grid; grid-template-columns: repeat(N, minmax(0, 1fr))`, with the default `align-items: stretch`. Never use `align-items: start` on a card grid.
3. **Gap** 16 px, both axes. On phones (container < 480): listings and loot 12, Pokédex 8.
4. **Columns** = `clamp(floor((W + gap) / (min + gap)), minCols, maxCols)` for container width W:

| Family | min card | columns (min to max) | Compact below |
|---|---|---|---|
| Comercio listing | 280 | 1 to 4 | never |
| Pokédex entry | 260 | 2 to 4 | card < 240 |
| Loot / drop | 240 | 1 to 4 | never |
| Featured (Destacados) | 200 | 4, 2 or 1 (divisors of 4) | never |
| Index panel | 290 | 3, 2 or 1 (bento, 6.5) | never |
| Guild KPI | 200 | 4, 2 or 1 | never |
| Info card | 280 | 2 or 1 | never |

5. **Order.** Cards go in DOM order = sort order, row-major. Never use `grid-auto-flow: dense`, `order` or explicit placement for cards.
6. An empty cell at the end of the last row stays empty (`auto-fill` keeps the track). A lone card keeps its column width; it never stretches across the row.

## 5. Card box and zones

### 5.1 Card box
`article[data-anat]`, 1 px `#22262f` border, radius 12, padding 16 (compact: 12), `min-width: 0`, no background, no shadow. The card itself is not a link and is not focusable. Its title is the link.

### 5.2 Zones on subgrid tracks
```
article[data-anat] {
  grid-row: span Z;                 /* Z = number of tracks of this card type (the same for the whole grid) */
  display: grid;
  grid-template-rows: subgrid;
  row-gap: 12px;                    /* zone gap; overrides the grid's 16 */
}
```
- A zone is one direct child element per track (`data-zone="head" | "facts" | "held" | "train" | "footer" | "elements" | "drops"`).
- The fact list and the listing footer are nested subgrids, with one track per row: `dl { grid-row: span n; display: grid; grid-template-rows: subgrid; row-gap: 6px }` (footer: 8px). When one card's value wraps, that row grows in every card of the grid row.
- Every card of one grid is built from the same **layout** (5.3), so all cards have the same Z.

### 5.3 Key set and zones: the union of the result set
The layout of a grid is computed from the cards it shows (the current page of results after filters), at render time:
- **Fact keys:** the family's canonical keys, in canonical order, that at least one card of the grid has a value for. A key unknown for every card disappears. A key known for some cards stays and shows "—" where it's missing.
- **Optional zones** (listing Held Items, Entrenamiento) exist when at least one card has them.
- **Price rows** (Dinero real, En el juego) exist when at least one listing of the grid has that price.
- The layout is recomputed when a filter or page changes (the React island uses the same function as the SSR).

### 5.4 Unknown values
An unknown or missing value shows as "—" (U+2014) in the value colour. A field that no card of the grid has is omitted (5.3), never filled with "—".

### 5.5 Footer pinning and the fallback
The footer is the last track, so the subgrid pins it to the bottom of the row. Browsers without subgrid use this rule:
```css
@supports not (grid-template-rows: subgrid) {
  article[data-anat] { display: flex !important; flex-direction: column; }
  article[data-anat] > * { align-self: stretch; }
  article[data-anat] > [data-zone="footer"] { margin-top: auto !important; }   /* beats the inline margin: 0 */
}
```
With subgrid removed in Chromium (simulated): row spread 0, footer pinned, hollow bottom = padding. Only the zone offsets of wrapped content differ (up to 44 px).

### 5.6 Fact rows
- Row: `display: flex; justify-content: space-between; gap: 8px; min-width: 0`, 12/16.
- `dt`: `#94979c`, `flex: none`.
- `dd`: **always `display: flex; align-items: center; justify-content: flex-end`**. With a block `dd`, inline-flex links and sprites grow the line box by about 4 px.
- Value modes:

| Mode | Behaviour | Used for |
|---|---|---|
| clip | one line, ellipsis | tier, level, counts |
| pre | one line, ellipsis, `white-space: pre` | spaced nicknames ("A M A T E R A S U  O M I K A M I") |
| wrap | at most 2 lines (`-webkit-line-clamp: 2`), label on the first line | loot values ("Evolución a Shiny Charizard") |
| node | a laid-out node (links, money, chips) | ball, elements, Cantidad of currency listings |
| nodetop | a node that may wrap; label on its first line | En el juego with two price options |

### 5.7 Clamps and reserved lines

| Text | Rule |
|---|---|
| Card title | 14/22 bold. Listing and loot: at most 2 lines. Pokédex: 1 line (compact: 2 lines, centred). |
| Meta line (world · time, Nº · Generación) | 12/16 `#94979c`, 1 line, ellipsis |
| Contact chip label | shrinks with an ellipsis before the chip row can overflow (`flex: 0 1 auto; min-width: 0`) |
| Held item label | "X-Attack T5", 1 line, ellipsis |
| Training | reserved row (value or "—") when the grid has the zone; the 4 px meter only with training |

## 6. Card families

### 6.1 Comercio listing (`listing_card`)
Zones (in order): **head · facts · [held] · [train] · footer**.

- **Head** (72 px track): a 72 px stage, then title (≤ 2 lines), a "Shiny" line (the shiny mark and "Shiny", 12/16) for shiny Pokémon, and the meta line "world · posted".
- **Facts:** one track per key of the grid (5.3).
- **Held** (Pokémon grids): "Held Items: N" (12/16 `#94979c`), then the held links in a 2-column grid. Each link is a 32 px slot plus "X-Attack T5" (tier in `#94979c`), 40 px tall, gap 4 × 8. 0 to 6 helds wrap onto 0 to 3 lines.
- **Train** (Pokémon grids): "Entrenamiento" and "Critical Damage 12 (40%)", or "—". With training, a 4 px meter (`#22262f` track, `#d97706` fill, `role="meter"`) 6 px below.
- **Footer:** 1 px `#22262f` top border and 12 px padding, then rows 8 px apart:
  - **Dinero real** (value 14/22 bold)
  - **En el juego** (price options, 10)
  - **Vendedor** (seller link, rating, reviews)
  - **Contacto verificado** (label, then 6 px, then one chip line, 9)

Stage and keys per type (canonical key order):

| Type | Stage (72) | Keys |
|---|---|---|
| Pokémon | wiki art 64, smooth, no frame | Requisito, Tier, Elementos, Ball, Aura, Boost, Nickname, Memory Slots, Star Level, NPC Price |
| Items | framed slot, sprite at 2x in the 64 cell, stack count | Cantidad, Categoría, Elemento, Uso, Drop de |
| Diamonds | framed slot, Diamond frame 0 at 2x, stack count | Cantidad (diamond sprite + number), Se compran en, Se usan en |
| Pokédólares | framed slot, `credit-card` at 2x | Cantidad (Pokédólares amount) |

A Pokédólares listing's title is the amount plus the currency: "500kk Pokédólares". Nested values:
- **Ball:** sprite 1x + name link.
- **Elementos / Elemento:** 16 px icon + name link per element.
- **NPC Price:** Pokédólares amount when numeric, else the text ("Unsellable").

Stress sizes at 304 px: Pokémon 657 (10 keys, 2 held lines, training, wrapped price), Items 371, Diamonds 327.

### 6.2 Pokédex entry (`dex_card`)
Zones: **head · facts · elements · drops**.
- **Head** (64): art 64 smooth + name (1 line) + "Nº 6 · Generación 1".
- **Facts:** Requisito, Tier, Rol, Variante (Shiny = shiny mark + "Shiny"): 82 px.
- **Elements:** one line of element chips (24 px, 16 px icon + name; an element without an icon, such as Siniestro or Acero, is a text chip).
- **Drops:** the label "Drops", 6 px, then one wrapping flow (gap 4):
  - drops with a sprite first, as 36 px slots (sprite 1x);
  - then drops without a sprite as named chip links (24 px, `#22262f`), at most 3. With more, show 2 and a "+N" button.
  - No known drops: "—".
  - The flow takes 1 or 2 lines. The drops track is shared, so a row with a 2-line card leaves a 28 px band under its 1-line cards (48 px under "—").

**Compact** (card < 240, phones):
- padding 12;
- head stacked and centred (art 64, then the name in ≤ 2 lines, centred, then "Nº 6 · Gen. 1");
- facts side by side;
- element chips icon-only, 24 px round with an `aria-label` (a text chip where there is no icon);
- drops as slots only: 3 per line, at most 6 (the 6th becomes "+N"). A drop without a sprite shows the missing-sprite mark.

Stress sizes: 304 px wide (3 at 944), rows 326/326/326/298; compact 175 × 376.

### 6.3 Loot / drop (`loot_card`)
Zones: **head · facts**.
- **Head** (40): a 40 px framed slot (sprite 1x, bg `#0c0e12`) + title (≤ 2 lines).
- **Facts:** keys of the grid from the canon Drop de, Elemento, Uso, Cantidad, Precio NPC (5.3). With today's data, Cantidad and Precio NPC exist for no drop, so they are omitted.
- Values use the wrap mode.
- "Drop de" with a single Pokémon is a link that opens the Pokédex tooltip. Elemento is the element link. Precio NPC is a Pokédólares amount.
- Stress: 288 px wide (3 in 896), every card 146 px.

### 6.4 Home featured card (`featured_card`)
- Link card 62 px tall: padding 12 × 16, 1 px border, radius 12.
- A 36 px sprite box, then the label (12/16.5, 1 line, ellipsis), then a 12 px arrow.
- Hover: background `#22262f`, and the arrow moves 2 px and turns `#94979c`.
- 4 columns with gap 8 at 944; 2 at ≥ 408; 1 on phones.

### 6.5 Home index panel (`index_panel`)
- **Header strip:** 24 px sprite, title 12/16 bold, count `#85888e`, bg `#13161b`, 44 px.
- **Links:** a grid with 2 link columns per spanned grid column, column gap 4, row gap 2, padding 8.
- **Every link row is 40 px** (44 on phones and coarse pointers). The 32 px icon cell is always present, so labels start at one x; labels have at most 2 lines.
- **Bento rule:** panels in one row have the same number of link rows, so their bottoms line up. The worlds table stretches (`height: 100%`) to its row.

| Columns | Rows |
|---|---|
| 3 (≥ 900) | Sistemas · Ítems · Mundos / Actividades · Pokédex (span 2 = 4 link columns, 18 links in 5 rows) |
| 2 | Sistemas · Ítems / Actividades · Mundos / Pokédex (span 2) |
| 1 | Sistemas, Ítems, Actividades, Pokédex, then Mundos |

- The 10-link panels are 271 px tall.

### 6.6 Guild KPI card (`kpi_card`)
- Three subgrid tracks: label (14/22 `#cecfd2`) · value (18/28 bold) · comparison (12/16 `#94979c`), gap 8.
- Padding 16, radius 11, bg `#0c0e12`.
- When a comparison wraps to 2 lines, the values still share one baseline.
- 4 columns at 944 (224 px), 2 at ≥ 416, 1 below.

### 6.7 Info card (`centered_card`)
- Bg `#13161b`, radius 12, padding 16 × 32, centred.
- Title 16/24 bold between two copies of its sprite (32 px box); body 14/22.
- Fills its grid cell (2 columns, 1 on phones); cards in a row share the height and their text starts at the top.

### 6.8 Detail page head row and evolution tiles
- **Head row** (art panel, in-game tooltip panel, outfit sprite panel, Aura buttons): one row height (`align-items: stretch`), sprites centred in their panels.
- **Evolution tiles:** one height per row. A Pokémon without a sprite shows the missing-sprite mark (7.2) inside its frame, not an empty frame.

## 7. Sprites, stages and slots

### 7.1 Integer scales
Pixel sprites use `image-rendering: pixelated` and are drawn at an integer scale k inside a 32 px game cell (a 2 × 2 tile sprite fills a 64 cell at 1x). They are centred on whole pixels: `left = floor((cell − w) / 2) · k`, `top = floor((cell − h) / 2) · k`. The 140 px wiki Pokémon art is an illustration: it scales smoothly to any size.

| Box | Size | Contents | Used in |
|---|---|---|---|
| Stage | 72 | 64 cell at 2x (+3 px air, 1 px frame, radius 8, bg `#13161b`) | listing head, Comercio Slots |
| Art stage | 72 / 64 | wiki art 64, smooth, unframed | listing head (Pokémon), Pokédex head |
| Slot | 40 | 32 cell at 1x (+3 air, 1 frame, radius 8, bg `#0c0e12`) | loot head, drops Slots and Lista |
| Drop slot | 36 | 32 cell at 1x (+1 air, 1 frame) | Pokédex drops strip |
| Held slot | 32 | missing-sprite mark 16 (radius 6, bg `#13161b`) | listing held items |
| Touch slot | 44 | 32 cell at 1x | phone Slots views |
| Tooltip head | 64 | cell at 2x (items), art 70 smooth (Pokémon), icon 32 (elements) | in-game tooltip |

Stack counts: 12/16 bold white, 1 px dark text shadow, bottom right (4 px, 1 px).

### 7.2 Empty slot vs. missing sprite
- **Empty slot** (inventory space with nothing in it): the frame only. It is used only where empty capacity is real game information; a card never adds empty frames to fill a strip.
- **Missing sprite** (a known entity whose sprite is not in the registry yet): a dark square at half the cell (16 in a 32 cell, 32 in a 64 cell): `#262b32`, inset 1 px `#373a41`, radius 3. The name stays available through the tooltip, the `aria-label`, and the named chip where there is room (6.2).

## 8. Nested entities and the in-game tooltip

- **The card opens no tooltip:** it already shows the tooltip content.
- **Nested entities open the in-game tooltip:** ball, element, held item, Diamonds amount, drop slot or chip, and a "Drop de" Pokémon link.
- **Slots and Lista rows** open the tooltip of their own entity.
- **Triggers** are real `<a>` or `<button>` elements with `aria-describedby` pointing to the tooltip (`role="tooltip"`).
- **Opening:** the tooltip opens on hover and focus, and on tap for coarse pointers (the first tap opens it, a second tap follows the link, a tap outside closes it).
- **Closing:** Escape closes it. The tooltip is hoverable: it stays open while the pointer moves from the trigger to the tooltip.
- **Pinning:** Shift pins it (footer "Mantén Shift para fijar").

**Placement:**
1. Vertical: above the trigger (6 px) by default. Below when opening above would cover the card's head zone (trigger top − 6 − tooltip height < head bottom). On today's anatomy:

| Zone | Opens |
|---|---|
| Listing facts, Pokédex elements and drops, loot facts | below |
| Listing Held Items and footer | above |

2. Horizontal: a trigger in the left half of its card anchors its left edge (−8 px); a right-aligned value or a trigger in the right half anchors its right edge (−8 px). Then shift so the tooltip stays 8 px inside the viewport (on phones, inside the 16 px gutters).
3. Slots: to the side (8 px) and flipped for slots near the right edge. On phones, below the slot, clamped to the gutters.
4. Lista: to the right of the name cell (12 px).

**Tooltip body:** panel `#21252c`, footer `#1d232b`, Poppins 600. Rows are 12/21 with labels in `#e8c66a` and values in white.
- A value never breaks inside itself (`white-space: nowrap` on the value).
- Width 282 by default; 240 for elements, balls and currencies; **300 for held items**, so "En Lucky Amulet:" and "mitad de efectividad" stay on one row.

## 9. "+N" overflow

- A chip line shows every chip up to its cap. Past the cap it shows cap − 1 chips and a **"+N" button**.

| Line | Cap |
|---|---|
| Contact channels | 3 |
| Pokédex named drops | 3 |
| Compact drop slots | 6 (the 6th slot becomes "+N", 36 px square) |

- "+N" is a `<button>` with `aria-expanded`, `aria-controls` and `aria-label` ("2 canales más: Correo, Teléfono +1").
- It opens a popover on click, tap, hover and focus. The popover is a list on the UI surface (`#22262f`, 1 px `#373a41`, radius 8, 12/16, padding 8 × 10, 6 px apart), not the in-game tooltip. Escape closes it.

## 10. Money: Pokédólares and Diamonds

**Name:** "Pokédólares" in Spanish, "Pokédollars" in English. "KKs", "KK" and "gold" are not used anywhere in the UI.

**Amount format** (k = thousand, kk = million, rounded half-up to one decimal, a trailing ",0" dropped):

| Value | es | en |
|---|---|---|
| 850 | 850 | 850 |
| 2 500 | 2,5k | 2.5k |
| 150 000 | 150k | 150k |
| 1 500 000 | 1,5kk | 1.5kk |
| 150 000 000 | 150kk | 150kk |
| 1 200 000 000 | 1.200kk | 1,200kk |

**Display:**
- The sprite `credit-card.png` (32 × 32, painted area 27 × 27 at x/y 3 to 29) goes **right before every in-game money amount**.
- **Size:** 32 px (1x, pixelated), in a 16 px text row. The 16 px 2:1 reduction reads as two bars at DPR 1, so it is not used. When a hand-drawn 16 px sprite is added to the registry (`currency.pokedolares16`), the helper uses it at 1x.
- **Margins:** −8 px top and bottom, so the row stays 16 px tall. −3 px on the left and 2 px on the right trim the transparent edges, so the card sits 4 px from the amount.
- The outer `inline-flex` has `vertical-align: top`, so it never grows a block line box (tooltip rows, table cells, prose).
- Screen readers get the exact number: "150.000.000 Pokédólares". The visible "150kk" is `aria-hidden`.
- **2x (64)** in the 72 stage of a Pokédólares listing and in its tooltip head.

**Where Pokédólares amounts appear:**
- listing "En el juego";
- the Cantidad of a Pokédólares listing;
- a numeric NPC Price;
- loot Precio NPC;
- Lista "En el juego" cells;
- tooltip rows ("Cantidad:", "En el juego:", "Precio NPC:").

A bare mention of the currency without an amount (a filter option, "Pago: Diamonds, Pokédólares o mixto") has no sprite.

**Diamonds:**
- Frame 0 of the Diamond sheet at 32 px, with the same −8 px margins, before the number.
- In a price, "400 Diamonds" is a link that opens the Diamonds tooltip (240 wide).
- A Diamonds listing's own Cantidad is the sprite + number, not a link.
- **Price options:** joined with "o". Each option carries its own "o", so a wrapped alternative starts its own line with "o" ("o 2.400 Diamonds"), right-aligned; the label aligns with the first line (nodetop).

## 11. Views: Cards, Slots, Lista

Every entity list offers the same three views.
- **Cards:** the families above. The card shows the tooltip content and opens none.
- **Slots:**
  - one slot per entity: 72 px for listings and Pokédex, 40 px for drops (44 px on phones);
  - inside a `#13161b` panel (radius 12, padding 16, gap 8, flex-wrap);
  - the stack count shows in the corner;
  - the slot is a link whose `aria-label` is the entity name (and its price for listings);
  - it opens the in-game tooltip;
  - Comercio groups its slots by asset type (a 88 px label column, groups separated by a 1 px border).
- **Lista:**
  - a RubinOT table (header `#22262f`, 1 px borders, radius 8), with a sprite cell (40 slot), the name link and the grid's columns;
  - the row hover background is `#13161b`;
  - hovering the row, or focusing the name, opens the tooltip to the right of the name;
  - tables keep their minimum widths and scroll horizontally on phones.

## 12. Responsive

| Viewport | Comercio (listing) | Pokédex | Loot (detail) | Home |
|---|---|---|---|---|
| 1440 | 944: 3 × 304 | 944: 3 × 304 | 896: 3 × 288 | featured 4, panels 3 (bento) |
| 1280 | 784: 2 × 384 | 784: 2 × 384 | 736: 2 × 360 | featured 2, panels 2 |
| 1024 | 992: 3 × 320 | 992: 3 × 320 | 992: 3 × 320 | featured 4, panels 3 |
| 768 | 736: 2 × 360 | 736: 2 × 360 | 736: 2 × 360 | featured 2, panels 2 |
| 390 | 358: 1 × 358, gap 12 | 358: 2 × 175 compact, gap 8 | 358: 1 × 358, gap 12 | featured 1, panels 1 (link rows 44) |

The Guild KPIs use 4 columns at 944 and 992, 2 at 736 and 784, and 1 at 358. The info cards use 2 columns, and 1 at 358.

## 13. Reading order, Tab order, accessibility

- DOM order = sort order = visual order. Groups come in the fixed type order; cards are row-major.
- Tab order inside a card: title link, then the nested links in reading order (facts, held items, drops), then the footer (Diamonds price link, seller link, "+N").
- Semantics:
  - `article` with an `h3` title (the group heading is an `h3` inside the page's `h2` section);
  - facts are a `dl` of `dt`/`dd` pairs;
  - chip and slot lists are `ul`;
  - the training meter is `role="meter"`;
  - sprites and missing-sprite marks are `aria-hidden`, and their names are text.
- Focus ring: 2 px solid `#444ce7`, 1 px offset, on every link, button and slot.
- Touch targets: fact rows are 16 px with a 6 px gap (22 px pitch). With `@media (pointer: coarse)` the fact and footer gap is 8 px, so the 24 px targets around inline links don't overlap (WCAG 2.5.8). Slots are 44 px on phones.
- Tooltips follow WCAG 1.4.13: they are dismissable (Escape), hoverable and persistent until pointer or focus leaves.
- Text zoom and text spacing only grow tracks, and every card of the row grows with them. Zone heights are never fixed.

## 14. Implementation (Astro 7 + Tailwind 4 + React 19 islands)

**Components (Astro, SSR):**
- `CardGrid.astro`: `family`, `items`, `layout`. Renders the grid container and the cards.
- `CardGroup.astro`: the sprite, the label and the count, then a `CardGrid`.
- `ListingCard.astro`, `DexCard.astro`, `LootCard.astro`, `FeaturedCard.astro`, `IndexPanel.astro`, `KpiCard.astro`, `InfoCard.astro`.
- `FactList.astro`: rows with modes.
- `Money.astro`: `kind="pd" | "dia"`, `amount` in units, with `formatKK(n, locale)` and the exact screen-reader text from `Intl.NumberFormat`.
- `Stage.astro` and `Slot.astro`: integer-scale placement, and the missing-sprite mark.
- `listingLayout(results)`, `gridKeys(canon, results)`: plain TypeScript, shared by the SSR and the islands.

**Grid container** (no JavaScript, same column counts as section 4):
```css
.card-grid {
  --gap: 16px; --min: 280px; --max: 4;
  display: grid; gap: var(--gap);
  grid-template-columns: repeat(auto-fill, minmax(max(var(--min), (100% - (var(--max) - 1) * var(--gap)) / var(--max)), 1fr));
  container-type: inline-size;
}
.card-grid[data-family="pokedex"] {           /* at least 2 columns */
  --min: 260px;
  grid-template-columns: repeat(auto-fill, minmax(max(min(var(--min), (100% - var(--gap)) / 2), (100% - 3 * var(--gap)) / 4), 1fr));
}
@container (max-width: 495px) { .card-grid[data-family="pokedex"] > article { /* compact anatomy */ } }
```

**Card:**
- Tailwind 4: `grid grid-rows-subgrid gap-y-3 min-w-0 p-4 border border-[#22262f] rounded-xl`, with `style="grid-row: span {Z}"`. Z comes from the layout; a class can't express a data-dependent span.
- Fact list: `grid grid-rows-subgrid gap-y-1.5` with `style="grid-row: span {n}"`.
- Compact variants use container queries on the grid (`@container` and `@max-[495px]:`).

**The fallback CSS (5.5)** lives in the global stylesheet.

**Tooltips:**
- One `TooltipLayer` React island per page, not one island per trigger.
- The SSR renders plain triggers: `<a href data-tip="item:fire-stone" aria-describedby="tt-…">`.
- The island delegates `pointerover`, `focusin` and `keydown` for the page and renders one tooltip from a JSON map of the page's entities.
- With `@floating-ui/react`:
  - `offset(6)`;
  - a custom `avoidHead` middleware, which flips to bottom when the tooltip would cover `closest('article').querySelector('[data-zone=head]')`;
  - `flip()`;
  - `shift({ padding: 8 })` (on phones, 16);
  - `useHover({ handleClose: safePolygon() })`, `useFocus`, `useDismiss` (Escape), `useRole({ role: 'tooltip' })`;
  - Shift toggles a pinned state.
- The same island drives the "+N" popovers (`useClick`, and `role` none).

**Other notes:**
- **Data:** compute the layout (5.3) in the page frontmatter from the page's results. Client-side filtering recomputes it with the same function.
- **Images:** every sprite has `width` and `height` (no layout shift); pixel sprites get `image-rendering: pixelated`. Art uses `loading="lazy"` after the first row.
- **Long lists:** paginate (the Pokédex has 910+ variants). Do not put `content-visibility: auto` on subgrid cards: off-screen cards would size their tracks from placeholders and break the row alignment.
- **Locale:** `formatKK` uses "," as the decimal separator and "." for thousands in es, and the reverse in en. The currency label comes from i18n ("Pokédólares" / "Pokédollars").

## 15. Board primitives (`canvas-v2/gen/common.py`, appended block)

| Primitive | Purpose |
|---|---|
| `RAIL_SPACER`, `GRID_RULES`, `COMPACT_BELOW`, `CARD_CSS`, `TIP_JS`, `FEATURED_CSS` | page spacer, column rules, fallback CSS, Escape handler, featured hover CSS |
| `grid_columns(width, min_card, cap, gap=16, floor=1)`, `family_columns(family, width, gap=16)` | column count |
| `card_grid(cards, cols, gap=16, width=None, extra='')` | grid container (stretch rows) |
| `card_group(head_html, grid_html, gap=12)`, `group_head(label, count, sprite_html='', level=3)` | titled group of one type |
| `grid_card(zones, anat, pad=16, gap=12, extra='')`, `card_zone(name, inner, style='')` | card on subgrid tracks, one zone per track |
| `card_head(stage, title_html, lines_html='', compact=False)`, `card_title`, `card_meta`, `shiny_line` | head zone |
| `fact_row(label, value, mode='clip', stacked=False)`, `facts_zone(rows, name='facts', gap=6, stacked=False)` | fact rows, nested subgrid |
| `grid_keys(canon, entities, values)`, `listing_layout(group)` | union key set and zones of a result set |
| `png_px(url)`, `sprite_of(name)`, `game_cell(sp, k=1, known=True)`, `sprite_stage(sp, size=72, qty=None, …)`, `missing_sprite(size=16)`, `stack_badge(n)` | integer-scale sprites, stages, missing-sprite mark |
| `kk(n)`, `parse_kk(text)`, `pd_img(size=32)`, `pd_money(amount, strong=False, size=32)` | Pokédólares amount |
| `dia_img(scale=1)`, `dia_amount(text, word=True, strong=False)`, `dia_money(tips, k, text, pos, default=False)`, `price_options(tips, key, game, pos)` | Diamonds amount and link, price options |
| `tip_link(tips, k, label_html, tt_html, a_style, …)`, `nested_element`, `nested_ball`, `element_tooltip`, `item_tooltip`, `pokedex_tooltip` | nested-entity triggers and tooltips (Escape closes) |
| `held_item_link(tips, k, name, tier, rows, pos, default=False)`, `held_strip(tips, helds, key, rows_for, cols=2, default=None)`, `training_zone(train)` | held items zone, training zone |
| `plus_n(tips, k, items_html, label, pos, size=None)`, `contact_chip(text)`, `chip_row(tips, labels, key, cap=3, …)` | chip line with the "+N" button |
| `listing_card(tips, x, layout, held_rows, default_held=None, pre='c', chip_cap=3, pad=16)` | Comercio listing |
| `drop_slot_link`, `drop_chip_link`, `drops_zone(tips, drops, key, rows_for, compact=False, …)`, `dex_card(tips, p, drop_rows, col=0, ncols=3, compact=False, …)` | Pokédex entry |
| `loot_values(x)`, `loot_card(tips, x, keys, dex_by, col=0, ncols=3, compact=False, …)` | loot / drop |
| `entity_slot(tips, k, sp, tt_html, label, size=40, qty=None, …)`, `slots_panel(slots_html, label)` | Slots view |
| `featured_card(label, sprite_html)`, `index_link`, `index_panel(pid, title, head_sprite, links, span=1, count=None, row_h=40)` | home |
| `kpi_card(label, value_html, foot)`, `centered_card(title, body, sprite_html)` | Guild figures, info cards |

Boards that use tooltips or "+N" add `CARD_CSS` to `extra_css` and `TIP_JS` to `extra_js`.

## 16. Checks
- `render.mjs --measure`: every card grid has `maxSpread` 0, and every row's `hollowBottom` equals its padding plus border (17) except where a shared drops or held track leaves one line of blank.
- Zone offsets within a row: spread 0.
- WCAG 1.4.12 overrides: no text spills out of a card, and no fact row overlaps the next.
- `validate.py` and `validate2.py`: 0 errors. Images only from `asset-map.json`.
- No provenance text, no "KKs", "KK" or "gold" in the UI, and a sprite before every in-game amount.
