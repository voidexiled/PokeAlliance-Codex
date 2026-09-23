# RubinOT Wiki — design reference (measured)

Source: https://wiki.rubinot.com/es. Captured 2026-09-18 with Playwright 1.63 (headless Chromium), dark theme as served (`<html class="dark">`), viewports 1440x900 and 390x844, plus 768, 1024, 1280 and 1920 for layout checks.
Stack: Next.js App Router, Tailwind v3 with custom tokens, Radix UI (Accordion, Select, Tooltip, Dialog, ScrollArea, Slider, Checkbox), cmdk (command palette), lucide icons for UI chrome only, next/image for sprites.

This document covers the design language only. Do not reuse RubinOT's logo, brand name, wording, images or sprites. Alliance Codex should copy the shell, density, type scale, palette and component anatomy, then fill them with PokeAlliance content and sprites.

All values are computed styles measured in the DOM. Tailwind classes are copied from `className`. Colors use the dark theme unless marked.

Raw data: `data/measure.json`, `data/mobile-measure.json`, `data/outline-*.txt` (DOM outlines with boxes and classes), `data/a.css` (the full site CSS), `data/c.css` (the sprite-sheet CSS module), `data/probe.txt` (palette, tooltip and select markup). Scripts: `01-discover.cjs` … `07-active.cjs`.

---

## 0. Summary tokens (paste-ready)

```css
/* Breakpoints (Tailwind screens): xs 460, sm 576, md 768, lg 1024, xl 1280, 2xl 1440 */
:root {            /* light */
  --bg-primary:#ffffff; --bg-secondary:#fafafa; --bg-tertiary:#f5f5f5; --bg-quaternary:#e9eaeb;
  --bg-primary-hover:#f5f5f5; --bg-active:#fafafa;
  --border-primary:#d5d7da; --border-secondary:#e9eaeb;
  --text-primary:#181d27; --text-secondary:#414651; --text-tertiary:#535862; --text-quaternary:#717680;
  --text-quinary:#a4a7ae; --text-disabled:#717680; --text-placeholder:#a4a7ae;
  --link:#444ce7; --ring:#a4bcfd; --bg-tooltip:#252b37; --text-tooltip:#fafafa;
}
.dark {
  --bg-primary:#0c0e12;        /* page, header, table body, inputs, dialogs */
  --bg-secondary:#13161b;      /* panel header strips, notes, info cards, promo card, palette footer */
  --bg-tertiary:#22262f;       /* table head row, chips, select listbox */
  --bg-quaternary:#373a41;
  --bg-primary-hover:#22262f;  /* the ONE hover color for everything */
  --bg-active:#22262f;
  --border-secondary:#22262f;  /* default border for every element (* { border-color }) */
  --border-primary:#373a41;    /* buttons, number fields, timeline dashes */
  --text-primary:#f7f7f7; --text-secondary:#cecfd2; --text-tertiary:#94979c;
  --text-quaternary:#85888e; --text-quinary:#61656c; --text-disabled:#85888e; --text-placeholder:#85888e;
  --link:#93c5fd;              /* in-table/entity links */
  --ring:#444ce7;              /* :focus-visible outline in dark */
  --bg-tooltip:#f7f7f7; --text-tooltip:#13161b;   /* tooltips are an INVERTED light pill */
}
/* Fixed accent colors seen in content (not tokens): */
/* info banner #991b1b (red-800) + #fff | inline blue link #3b82f6 (blue-500) | selected toggle / checkbox #d97706 (amber-600) */
/* slider + percent #f59e0b (amber-500) | helper text #a1a1aa (zinc-400) | boss quote #d14703 | bronze tier bg #8B4513 (dark) */
/* overlay rgba(0,0,0,.8) + backdrop-blur 4px | scrollbar thumb #85888e */
```

| Token | Value |
|---|---|
| Body font | `Verdana` (self-hosted Microsoft Verdana Regular 400 and Verdana Bold declared as weight 600), fallback `system-ui, sans-serif`. `html{font-family:var(--font-verdana),system-ui,sans-serif}` |
| Secondary font | `Inter` variable 100–900 (Google, OFL), used only through `.font-inter` on notes, story boxes and the promo card |
| Mono | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, …` only in `<kbd>` |
| Base | 16px / 24px, `-webkit-font-smoothing: antialiased`, `body{overflow-x:hidden}` |
| Radius scale | 2 (select option) · 4 `rounded` · 6 `rounded-md` · 8 `rounded-lg` · 10 (promo button, inner dialog) · 11 `rounded-[11px]` (buttons, inputs, selects) · 12 `rounded-xl` (cards, panels, palette) · full (chips, slider) |
| Shadows | none on surfaces. Only `shadow-sm` on the palette footer keycaps |
| Motion | colors 150ms `cubic-bezier(.4,0,.2,1)`; chevron rotate 200ms; accordion 200ms ease-out; image fade-in 300ms; dialog/tooltip/select enter 150ms (fade + zoom 95% + 8px slide); mobile sheet 500ms in / 300ms out |
| Layout at 1440 | sidebar 208 · gap 40 · main 896 · gap 40 · right rail 256. Header 64 fixed |

Weight mapping: only two Verdana files exist, so `font-semibold` (600) and `font-bold` (700) both render Verdana Bold, and `font-medium` (500) renders Regular. Visually the site has two weights: regular and bold.

---

## 1. Page shell

### 1.1 Layout grid
- `body.flex.flex-1.flex-col` → root `div.flex.flex-1.flex-col.bg-bg-primary`.
- Scroll lives in a Radix ScrollArea: `div.relative.mt-16.h-[calc(100dvh-4rem)]` > `[data-radix-scroll-area-viewport].size-full`. The window itself never scrolls.
- Content row: `div.relative.mx-auto.flex.justify-between.gap-10.px-4.pt-8.xl:px-0.max-w-full`
  - `gap` 40px, `padding-top` 32px, side padding 16px below 1280 and 0 from 1280.
  - The header "layout" toggle (icon `gallery-horizontal`) switches `max-w-full` to `max-w-9xl` (1536px, centered). At 1440 or below it changes nothing visible. On the home page it drops the right spacer.
- Three children:
  1. Left sidebar `div.sticky.left-0.top-8.hidden.h-fit.xl:block` (208px, x=0). Hidden below 1280.
  2. Main `div.flex.min-w-0.max-w-9xl.flex-1.flex-col.space-y-12`: `flex:1`, `max-width` 1536, 48px vertical rhythm between blocks.
  3. Right rail `div.sticky.right-0.top-8.hidden.h-fit.w-64.shrink-0.flex-col.gap-8.pb-4.pr-4.text-xs.xl:flex` (256px, 16px right padding, so the content is 240px). Hidden below 1280.
     On the home page the rail is replaced by an empty spacer `w-52` (208px), so the main column is 944px.
- Measured x/width:
  | viewport | sidebar | main | rail |
  |---|---|---|---|
  | 390 | hidden | 16 / 358 | hidden |
  | 768 | hidden | 16 / 736 | hidden |
  | 1024 | hidden | 16 / 992 | hidden |
  | 1280 | 0 / 208 | 248 / 736 | 1024 / 256 |
  | 1440 | 0 / 208 | 248 / 896 | 1184 / 256 |
  | 1440 home | 0 / 208 | 248 / 944 | spacer 1232 / 208 |
  | 1920 | 0 / 208 | 248 / 1376 | 1664 / 256 |
- Item and mount detail pages use a different main (`div.min-w-0.flex-1.space-y-6`, no rail, 1192px at 1440) with a 24px rhythm instead of 48px.
- The first content line sits at y=96 (64px header + 32px padding-top). The sidebar and rail are `sticky; top:32px`.

### 1.2 Header (`header`)
`fixed top-0 z-50 flex h-16 w-full items-center justify-center border-b border-b-secondary bg-inherit px-4 backdrop-blur`
- Height 64, padding 0 16px, background #0c0e12 (inherited), `backdrop-filter: blur(8px)`, bottom border 1px #22262f, z-index 50.
- Inner `div.relative.flex.h-16.w-full.items-center.justify-between.gap-2.max-w-full` (8px gap).
- **Logo**: `a.shrink-0 > img.h-9`, 36px tall (81x36). No text next to it.
- **Center search trigger** (every page except home, md and up): `button … h-9 px-3 text-sm border hover:bg-bg-primary-hover absolute left-1/2 top-1/2 hidden w-full max-w-md -translate-x-1/2 -translate-y-1/2 justify-between rounded-xl border-b-secondary pr-1 md:flex`
  - 448x36, rounded 12, 1px #22262f, padding 0 4px 0 12px, 14px/22 weight 500.
  - Left: `lucide-search` 16px + placeholder "Buscar..." in #85888e.
  - Right: `kbd.rounded-lg.bg-bg-secondary.px-1.5.py-px.text-[10px]` reading "Ctrl + K" in monospace 10px, bg #13161b, radius 8, padding 1px 6px, 56x24.
  - Hover: background #22262f. Opens the command palette.
- **Right cluster** `div.flex.items-center.gap-2`:
  - Language select (xl and up): `button[role=combobox] … h-9 w-48 rounded-[11px] border-none bg-transparent px-3 py-2 text-sm hover:bg-bg-primary-hover data-[state=open]:bg-bg-tertiary`. 192x36, `lucide-globe` 16 + "Español" + `chevron-down` 16. Hover #22262f.
  - Vertical separators `div[role=none].w-[1px].h-4.bg-b-secondary` (1x16, #22262f) between groups.
  - Icon buttons `size-8 rounded-[11px] [&>svg]:size-4.5 hover:bg-bg-primary-hover`: 32x32, radius 11, 18px lucide icon, no border. They are the layout toggle (xl and up) and the theme toggle (`moon`/`sun`).
  - Below 1280: hamburger (`lucide-menu`, 32x32) opens the mobile sheet. Below 768: a search icon button replaces the center trigger.

### 1.3 Left sidebar
Wrapper `div.sticky.left-0.top-8` > scroller `div.overflow-y-auto hide-scroll-bar h-[calc(100dvh-6rem)] w-52 shrink-0` with a scroll mask:
`data-[top-scroll]/[bottom-scroll]/[top-bottom-scroll]:[mask-image:linear-gradient(…var(--scroll-shadow-size)…)]`, where `--scroll-shadow-size` is 80px. The list fades over the last or first 80px instead of showing a scrollbar. The scrollbar itself is hidden.
Inner `div.flex.flex-col.gap-0.px-4.pb-4` (padding 0 16px 16px, 176px usable).

**Top-level links (Home, Discord)** `ul.text-xs > a > li.flex.cursor-pointer.items-center.gap-2.rounded-lg.py-1.5.pl-2.pr-1.hover:bg-bg-primary-hover`
- 176x28, padding 6px 4px 6px 8px, radius 8, gap 8, 12px/16 regular, color #f7f7f7.
- External link: `justify-between` with `lucide-arrow-up-right` 16px on the right.

**Group (Radix Accordion item)**
- Trigger `button.flex.w-full.items-center.justify-between.gap-2.py-2.text-xs.font-bold`: 176x32, padding 8px 0, 12px bold, #f7f7f7, no background and no hover change.
  - Chevron `lucide-chevron-down` 16px, `transition-transform duration-200`, rotated 180° when open, so an open group shows an up-chevron.
  - The trigger holds three svgs (chevron-down, circle-plus, circle-minus). Classes hide the last two.
  - "Destacados" is a pinned group: the trigger is `disabled`, all svgs are hidden and it cannot collapse.
- Content `div[role=region].overflow-hidden.text-sm.data-[state=closed]:animate-accordion-up.data-[state=open]:animate-accordion-down` (200ms ease-out height).
- Sub-list `ul.ml-1.5.flex.flex-col.gap-0.5.border-l.pl-1.5.text-xs`: margin-left 6, border-left 1px #22262f, padding-left 6, 2px gap. The border-left line is the only visual nesting cue.
- Sub-link `a > li` uses the same class as the top-level links (163x28, radius 8, 12px, #f7f7f7).
  - Optional sprite icon: `div.relative.w-fit.shrink-0.animate-smooth-bounce.duration-5000 > img` rendered at 16px (natural 16x15 kept at 1x; 32x32 sources downscaled to 16). The bounce is a 5s ease-in-out loop that lifts 3px at 25% and 75%. Only the "Destacados" group has icons; the other groups are text only.
  - Disabled entry: `li > span.cursor-not-allowed.text-t-disabled` (#85888e).
- Hover: background #22262f. The text color does not change.
- There is **no active-page state**: the current page gets no highlight and no `aria-current`. Alliance Codex should add one (`bg-bg-active` #22262f plus `aria-current="page"`) as a deliberate improvement.
- Screenshots: `shots/state-sidebar-expanded.png`, `state-sidebar-sistemas-collapsed.png`, `state-sidebar-all-collapsed.png`, `state-sidebar-link-hover.png`.

### 1.4 Mobile sheet (< 1280)
`div[role=dialog].fixed.inset-y-0.right-0.z-50.h-dvh.w-72.border-l.bg-bg-primary … data-[state=open]:slide-in-from-right data-[state=open]:duration-500 data-[state=closed]:duration-300`
- Opens from the right, 288px wide, left border #22262f, black/80 overlay behind.
- Contents: centered logo at 56px tall (`h-14`), `py-4 gap-4`. Then a divider `mx-6` 1px #22262f, the language select (`mx-4`, full width, h-9, bordered), another divider, and the same nav list as the desktop sidebar (`px-4 pb-4`).
- Screenshot: `shots/mobile-390-menu-open.png`.

### 1.5 Right rail
- **TOC "Resumen"** `div.flex.flex-col.gap-2.5.text-xs`:
  - Title `p.font-bold` 12px bold, then a divider `div.h-[1px].bg-b-secondary` with a 4px top margin (`space-y-1`).
  - `ol.flex.list-inside.list-decimal.flex-col.gap-2`: 8px gap, decimal markers inside ("1. Misiones diarias").
  - `li.text-t-secondary` (#cecfd2) > `a.hover:underline`, 12px/16. The items mirror the section h2 ids (`#daily-missions` …).
  - No scroll-spy and no active item. Hover only underlines.
  - Only present when the page has sections. On system pages without sections the rail holds just the promo card.
- **Promo card** (RubinOT marketing, do not copy the content) `div.flex.flex-col.gap-2.rounded-xl.bg-bg-secondary.p-3.font-inter`: 240 wide, padding 12, radius 12, bg #13161b, Inter. Title 14/22 weight 600, body 12/16 #cecfd2, and a small button `h-7 rounded-[10px] px-3 text-xs font-medium bg-white text-black mt-2` (28px tall, white on black). This is the only solid "CTA" style on the whole site.
- Rail gap between blocks is 32px.

### 1.6 Footer (inner pages only; home and detail pages have none)
`div.flex.items-center.justify-between.border-t.py-4.text-xs.text-t-tertiary`, the last child of the main column (48px above it from space-y-12).
- Border-top 1px #22262f, padding 16px 0, color #94979c.
- Left: social icon buttons `size-6 rounded-[11px] [&>svg]:size-3.5` (24x24, 14px svg, gap 8), hover bg #22262f.
- Right: copyright `p.text-xxs` (10px/16).
- Alliance Codex: put the required line "Alliance Codex es un proyecto comunitario independiente, no afiliado a PokeAlliance." in this exact slot at 10–12px #94979c.

---

## 2. Search trigger and Ctrl+K palette

### 2.1 Home search trigger
`button … h-9 border hover:bg-bg-primary-hover w-full items-center justify-between gap-3 rounded-xl border-b-secondary px-4 py-2.5 text-sm hidden md:flex`
- Full main width (944 on home), 36px tall, radius 12, 1px #22262f, padding 10px 16px, gap 12, 14px weight 500.
- `lucide-search` 16px #94979c + placeholder "Busque por páginas, ítems, monturas..." (#85888e). The `kbd` sits right (same as the header one).
- Hover: bg #22262f. Hidden below 768; mobile uses the header search icon.

### 2.2 Palette (cmdk inside a Radix Dialog)
- Overlay: `fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/80 py-10 backdrop-blur-sm` (rgba(0,0,0,.8), blur 4px, 40px vertical padding), enter 150ms fade.
- Panel: `relative z-50 w-full max-w-screen-sm rounded-xl border border-b-primary dark:border-b-secondary bg-bg-primary overflow-hidden p-0`, 576x403 centered (x=432, y=249 at 1440x900), radius 12, 1px #22262f, bg #0c0e12, no shadow. Animation: fade in plus zoom from 95%.
  At 390 it becomes 374 wide with 8px side margins.
- Input row `div.flex.h-12.items-center.gap-2.border-b.px-3`: 48 tall, padding 0 12, bottom border.
  - `lucide-search` 16px at `opacity-50`.
  - Input `text-sm bg-transparent`, placeholder #85888e, no focus ring.
  - Clear button `size-6 [&>svg]:size-3.5` with `lucide-x`.
- List: `div.relative.h-[320px]` in a ScrollArea with an 8px track and 3px #85888e thumb.
  - Group `p-1`, heading `[cmdk-group-heading]` at `px-2 pt-4 pb-2.5 text-xs font-medium text-t-secondary` (12px, #cecfd2). Headings seen: "Destacados", "Artículos", "Items".
  - Item `[cmdk-item].relative.flex.items-center.gap-2.rounded-lg.px-3.py-2.5.text-sm.cursor-pointer.data-[selected=true]:bg-bg-secondary`: 558x42–47, radius 8, padding 10px 12px. The inner row uses `gap-3` with a sprite at 24px and the label `span.font-medium` (14px).
  - The selected or hovered item gets bg #13161b. That is the only highlight (no border, no accent color).
- Footer `div.flex.items-center.gap-2.border-t.bg-bg-secondary.px-4.py-2.text-xs.font-medium.text-t-secondary`: 33 tall, bg #13161b.
  - Keycaps `div.flex.size-4.items-center.justify-center.rounded.bg-bg-primary.shadow-sm` (16x16, radius 4, bg #0c0e12, shadow-sm) with 12px arrow-up, arrow-down and corner-down-left icons.
  - Labels "para navegar" and "ir para página", separated by a 1x12 divider in #373a41 with `mx-2`.
- Screenshots: `shots/state-palette-open-empty.png`, `state-palette-query-backpack.png`, `state-palette-query-arrow-selected.png`, `mobile-390-palette-open.png`.

---

## 3. Home page (`/es`)
Main column `div.flex.flex-col.gap-4.pb-6.md:gap-6` (24px gaps at md and up):

1. **Intro row** `div.flex.flex-col.gap-3.sm:flex-row.sm:items-center.sm:justify-between.sm:gap-4`
   - Left `div.flex.items-center.gap-4`: logo `img.w-28` (112px, hidden below 576) + text block.
     - `h1.text-base.font-semibold`: 16/24 bold, e.g. "Bienvenido a RubinOT Wiki!".
     - `p.mt-0.5.max-w-xs.text-xs.text-t-secondary`: 12/16, #cecfd2, max 320px.
     - No slogan and no CTA.
   - Right: social links `a.rounded-lg.p-2.text-t-tertiary.transition-colors.hover:bg-bg-primary-hover.hover:text-t-primary` (34x34, 18px svg, gap 2px). Color #94979c, turning #f7f7f7 on a #22262f hover.
2. **Search trigger** (2.1).
3. **"Destacados"** block `div.flex.flex-col.gap-2.5` (10px):
   - Label `p.text-[11px].font-semibold.uppercase.tracking-widest.text-t-tertiary`: 11px/16.5, bold, uppercase, letter-spacing 1.1px, #94979c. This is the ONLY uppercase label on the site besides one calculator caption.
   - Grid `div.grid.gap-2.sm:grid-cols-2.md:grid-cols-4` (8px gap; 1 column below 576).
   - Card `a.group.flex.items-center.gap-3.rounded-xl.border.px-4.py-3.transition-colors.hover:bg-bg-primary-hover`
     - 230x62 at 1440, radius 12, 1px #22262f, padding 12px 16px, gap 12, transparent background.
     - Sprite slot `div.flex.size-9.shrink-0.items-center.justify-center`: 36px box, sprite at 32px with the 5s bounce.
     - Label `span.flex-1.text-xs.font-medium.leading-snug`: 12px/16.5, regular.
     - Arrow `lucide-arrow-right size-3 text-t-disabled group-hover:translate-x-0.5 group-hover:text-t-tertiary`: 12px #85888e. On card hover it moves 2px right and turns #94979c (150ms).
     - Card hover: bg #22262f. No lift, scale or shadow.
4. **Panels grid** `div.grid.grid-cols-1.gap-4.lg:grid-cols-3.lg:items-start`
   - Left `lg:col-span-2` > `div.grid.grid-cols-1.gap-4.sm:grid-cols-2` of **index panels**.
   - Right column: **worlds table**.

### 3.1 Index panel (category card)
`div.overflow-hidden.rounded-xl.border` (304 wide at 1440, radius 12, 1px #22262f, transparent body)
- **Header strip** `div.flex.items-center.gap-2.5.border-b.bg-bg-secondary.px-4.py-2.5`: 45 tall, bg #13161b, bottom border, padding 10px 16px, gap 10.
  - Sprite box `div.flex.size-6.shrink-0.items-center.justify-center > img` (24px).
  - Title `h2.flex-1.text-xs.font-semibold` (12/16 bold).
  - Count `span.text-[11px].tabular-nums.text-t-disabled` (11px, #85888e, right-aligned by flex-1), e.g. "15".
- **Link grid** `div.grid.grid-cols-2.gap-x-1.gap-y-0.5.p-2`: 2 columns, 4px column gap, 2px row gap, padding 8.
  - Link `a.flex.items-center.gap-1.5.rounded-md.px-2.py-1.5.text-xs.text-t-secondary.transition-colors.hover:bg-bg-primary-hover.hover:text-t-primary`: 141x28 (grows to 44 when the label wraps), radius 6, padding 6px 8px, gap 6, 12px #cecfd2. Hover: bg #22262f and text #f7f7f7.
  - Sprite `img.shrink-0.object-contain` at 16px (natural sizes vary: 16x15, 22x25, 32x32, 64x64, all fitted to 16).
  - Disabled: `span.cursor-not-allowed … text-t-disabled` with the sprite at `opacity-40`.
- Panels sit in a 2-column masonry-like grid (items-start) with 16px gaps. Their heights differ with the link count.

### 3.2 Worlds table (live data list)
`div.overflow-hidden.rounded-lg.border` (304x527, radius 8)
- Header: its own table `table-fixed`, th `bg-bg-secondary py-2.5 text-xs font-bold border-none` (45 tall, #13161b). Columns 55% / 20% / 35%.
  - Sortable headers are buttons `flex h-6 items-center gap-1.5` with a 12px up/down sort glyph ("Nombre ⇕", "En línea ⇕").
- Body: `div.h-[480px]` ScrollArea, rows `h-11` (44px), `border-none` (no row lines), 14px/22.
  - Name left in a `flex items-center gap-2`.
  - PvP-type icon 24px (48 natural) inside a tooltip button.
  - Online count centered.
- No zebra striping and no row hover.

---

## 4. Inner page anatomy (system page / sub page)

Order inside the main column (48px between each):
`nav[aria-label=breadcrumb]` → title block → (optional) info banner → `div.flex.flex-col.gap-12` of sections → footer.

### 4.1 Breadcrumbs
`nav > ol.flex.flex-wrap.items-center.gap-1.5.break-words.text-xs.text-t-quaternary.sm:gap-2.5`
- 12px/16, #85888e, gap 10px (6px below 576).
- Crumb `li.inline-flex.items-center.gap-1.5 > a.hover:underline`. The first crumb is the sidebar group name and links to `#`.
- Separator `li[role=presentation]` > `lucide-chevron-right` 14px, #85888e.
- Current page `span[role=link].text-t-primary` (#f7f7f7).
- Hover: underline only.

### 4.2 Page title + parenthetical subtitle
`div.space-y-2`
- `div.flex.items-center.gap-2.5`:
  - `h1.text-3xl.font-bold`: 30px/36, bold, e.g. "Battle Pass".
  - `h2.hidden.translate-y-[3px].text-lg.font-bold.xs:block`: 18px/28 bold, nudged down 3px to share the baseline, e.g. "(Pase de batalla)". Hidden below 460px.
- Divider `div[role=none].h-[1px].w-full.bg-b-secondary`: 1px #22262f, 8px below the title.
- Detail pages use the same h1 + divider without the parenthetical.

### 4.3 Section h2 with divider
`div#<id>.flex.scroll-mt-4.flex-col.gap-4.text-sm` (16px gap inside the section; the `scroll-mt-4` anchor offset works with the TOC)
- Heading block `div.space-y-1`:
  - `h2.text-xl.font-bold`: 20px/28 bold.
  - Divider 1px #22262f, 4px below the h2.
- Sub-heading `h3.mt-6.text-base.font-bold`: 16/24 bold, 24px top margin.
- Some pages use `h2.text-lg` (18px) for minor sections.

### 4.4 Paragraphs and lists
- Paragraph `p.text-justify.text-sm`: 14px/22, #f7f7f7, **justified**. Intro paragraphs are 896 wide with no max-width, so lines run the full column.
- Bullets:
  - `ul.w-full.list-inside.list-disc.space-y-2.text-sm`: markers inside, 8px between items.
  - Variant `ul.list-disc.space-y-2.pl-6` (markers outside, 24px indent).
- Emphasis uses `strong`/`span.font-bold` inline. There are no colored highlights.
- Inline links, two styles:
  - Entity and page links `a.text-link.hover:underline`: #93c5fd, underline on hover.
  - Prose anchors `a.text-blue-500.underline`: #3b82f6, always underlined (e.g. "abajo").
  - "(List)" and "Más..." triggers `text-blue-600 dark:text-blue-500 hover:underline`.
- Helper text `p.ml-5.mt-1.text-xs.text-zinc-400` (#a1a1aa) under list items. Inline 14–16px sprites (`img.inline`) sit next to words.

### 4.5 Info banner (red strip)
`div.flex.items-center.justify-center.gap-4.rounded-lg.bg-red-800.p-4.text-xs.text-white`
- Full width, radius 8, bg #991b1b, text #fff 12/16, padding 16, gap 16. No border and no icon font.
- Left: sprite `large-book.gif` at 64x32 (natural size). Alliance Codex should use a PokeAlliance sprite here.
- Text column `div.flex.flex-col.gap-2.lg:flex-row.lg:gap-4`: facts in `p` elements separated by `span.hidden.font-medium.lg:flex` "|" dividers at lg and up. Below 1024 they stack with an 8px gap.
- Content is terse facts only: requirement, season, date. E.g. "Requisitos para adquirir el pase: nivel 8 y una vocación | Season 01 | Disponible hasta: 23/07/25 a las 7h". Alliance Codex: "Nivel 120".
- Variant with more facts: `py-4` without `p-4`, `gap-6` groups, the sprite `hidden xs:block`.

### 4.6 Centered info cards (sprite in title)
`div.flex.flex-col.items-center.gap-4.rounded-xl.bg-bg-secondary.p-4.px-8.text-center.sm:w-96` (or `lg:w-1/3` for three across)
- 384x116, radius 12, bg #13161b, padding 16px 32px, gap 16, no border.
- Title row `div.flex.items-center.gap-1` (or gap-2): sprite 24px + `p.text-base.font-bold` (16/24) + the same sprite 24px again. The sprite appears on both sides.
- Body `p.text-sm` centered, 14/22.
- Row wrapper `div.mx-auto.flex.flex-col.gap-4.lg:flex-row`.

### 4.7 Timeline with dates and chips
Container `div` (or `div.py-2`), one row per event:
- Row `div.flex.gap-1.5` (6px gap).
- Rail column `div.relative.-mt-0.5` (20px wide):
  - Node `div.relative.z-20.h-fit.w-5 > sprite` at 20px (different sprites per event type).
  - Line `div.absolute.left-1/2.top-0.z-10.mt-1.h-full.w-px.-translate-x-1/2.text-b-primary` with inline style `background: linear-gradient(currentcolor 6px, transparent 6px) 50% 50% / 1px 10px repeat-y`. That draws a **dashed 1px line (6px dash, 4px gap) in #373a41**.
  - The last row has no line.
- Content `div.flex.flex-col.gap-2.pb-6` (24px bottom spacing per row):
  - Date `p.text-xs.italic` (12px italic), e.g. "Lanzado en 18/06/25:" or "19:40 - El lobby se abre…".
  - Chips `div.flex.w-fit.flex-col.gap-2.xs:flex-row.xs:gap-1` > `span.flex.items-center.gap-1.rounded-full.bg-bg-tertiary.py-1.pl-2.pr-2.5.text-xs`: 24 tall, bg #22262f, padding 4px 10px 4px 8px, 16px sprite + 12px text, e.g. "2 Misiones Bronce". A text-only chip uses `px-2`.
  - Rows can also hold `ul.list-inside.list-disc.space-y-1.text-sm`.

### 4.8 Image banner cards grid (season links)
`div.grid.grid-cols-1.gap-4.md:grid-cols-2.2xl:grid-cols-3`
- Card `a.relative.min-h-36.w-full.overflow-hidden.rounded-xl.border.bg-cover.bg-center.hover:underline` with a CSS `background-image` banner (e.g. `.bg-battle-pass-season-01{background-image:url(/banners/…-off.avif)}`).
  - 288x144 at 1440, radius 12, 1px #22262f.
  - Overlay `div.absolute.inset-0.bg-gradient-to-t.from-black/50.via-black/20.to-transparent`.
  - The title is baked into the image. There is no HTML label and hover does nothing visible.
- The one current item uses an "-on" image variant (`bg-battle-pass-season-05-on`).

### 4.9 Video embed
`div.mx-auto.w-full.max-w-[1080px].rounded-xl.lg:bg-bg-secondary.lg:p-1` > `div.relative.overflow-hidden.pb-[56.25%]` > `iframe.absolute.left-0.top-0.size-full.rounded-lg`
- The frame is a 4px #13161b mat with radius 12 (lg and up) around a radius-8 iframe, 16:9.

### 4.10 Segmented selector buttons (tabs)
`div.mx-auto.grid.w-fit.gap-2.xs:grid-cols-2.md:grid-cols-4`
- Button `button.relative.flex.items-center.justify-center.gap-2.rounded-lg.border.border-b-primary.py-2.pl-3.pr-6.hover:bg-bg-primary-hover`
  - 213x50, radius 8, **1px #373a41** (stronger than the default border), padding 8px 24px 8px 12px.
  - Inner `div.z-20.flex.items-center.justify-center.gap-4`: sprite 32px + `span.text-sm.font-bold`.
- Hover: bg #22262f.
- **Selected**: filled with the tier color. Bronze is `bg-[#CD7F32] dark:bg-[#8B4513]`. There are no aria states (a gap to fix).
- Alternative selected style for content toggles (boss selector): `border-amber-300 ring-1 ring-amber-300 dark:border-amber-600 dark:ring-amber-600`, i.e. a 1px border plus a 1px ring in #d97706 (2px amber total).
- Grid variant (drop-system seasons): `rounded-lg border border-b-secondary px-4 py-2` with 48px sprites on both sides of the label.
- Screenshot: `shots/state-segmented-tabs-selected.png`.

### 4.11 Data tables
Wrapper chain:
- `div.relative.w-full` (Radix ScrollArea, horizontal) > `div.size-full` > `div.overflow-hidden.rounded-lg.border.dark:border-b-secondary`: radius 8, 1px #22262f.
- The horizontal scrollbar shows below the table (`h-2 p-0.5`, 3px #85888e thumb) when it overflows.

Table and header:
- `table.relative.w-full.caption-bottom.border-collapse.bg-bg-primary.text-sm` (bg #0c0e12, 14/22).
- Header row `tr.border-b.bg-bg-tertiary` (#22262f), th `h-8 whitespace-nowrap border-r px-4 text-center align-middle text-xs font-semibold last:border-r-0`.
  - 32 tall, 12px bold, centered, vertical column dividers 1px #22262f.
  - Fixed widths via `w-[108px] min-w-[108px] max-w-[108px]`, `min-w-96` for description columns.

Body:
- tbody `[&_tr:last-child]:border-0` (plus `whitespace-nowrap tracking-[-0.0125em]` on dense tables: -0.175px).
- Row `tr.border-b` (1px #22262f).
- Cell `td.h-14.border-r.px-4.text-center.align-middle.last:border-r-0`: min-height 56, padding 1px 16px, centered. Compact variant `h-10` (40); prose variant `h-auto py-3 text-left`.
- **No zebra, no row hover, no sticky header** (except the worlds table's detached header).

Cell patterns:
- Sprite cell `div.relative.w-fit.shrink-0.mx-auto.py-2 > img` at 48px (32px sources shown at 1.5x). Mounts are shown at about 1.5x their natural size.
- Name cell `a.mx-auto.flex.w-fit.items-center.justify-center.gap-2.text-link.hover:underline` (#93c5fd).
- Reward cell `div.mx-auto.flex.w-fit.items-center.gap-2`: sprite 24/32 + `p` + an optional info icon `button.cursor-default > lucide-info size-3` (12px) that opens a tooltip.
- Date `span.text-xs` (e.g. "13/05/2024").
- Tier-colored first column: `td.bg-[#CD7F32].dark:bg-[#8B4513]` with sprite 32 + tier name.
- "Más..." link `span[role=button].text-xs.text-blue-600.dark:text-blue-500.hover:underline`.

Sorting:
- Sortable th hold `button.flex.w-full.items-center.justify-center.gap-0.5` with a 7x12 two-arrow glyph.
- No hover style on sort buttons.

Screenshots: `shots/desktop-1440-item-category-backpacks-*.png`, `state-table-sorted-by-date.png`, `desktop-1440-subpage-battle-pass-temporada-01-full.png` (rewards table).

### 4.12 Notes and callouts (Inter italic)
- **Horn note** (centered): `div.mx-auto.flex.w-fit.items-center.gap-6.whitespace-pre-line.rounded-xl.bg-bg-secondary.px-4.py-2.text-justify.font-inter.text-sm.italic`
  - Radius 12, #13161b, padding 8px 16px, 24px gap, Inter 14/22 italic.
  - A 32px sprite on each side; the right one is `hidden md:block`.
- **Observation note** (full width): `p.whitespace-pre-line.rounded-xl.bg-bg-secondary.p-4.text-justify.font-inter.text-sm.italic` with a bold lead label, e.g. "**Observación:** …" or "**Importante:**".
- **Example box**: `div.flex.flex-col.gap-2.rounded-xl.bg-bg-secondary.p-4` with a `p.text-sm.font-semibold` title and a `ul.list-disc.pl-6` list.
- **Story box**: `div.space-y-4.rounded-xl.bg-bg-secondary.p-4.font-inter.text-xs.italic` (12px italic Inter).
- No left accent bars, no icons from icon sets and no colored backgrounds. The flat #13161b surface carries the callout.

### 4.13 Tiles, stat boxes, loot rows, gallery
- **Tile grid** (races): `ul.grid.grid-cols-3.gap-3.sm:grid-cols-4.md:grid-cols-7` > `li.flex.flex-col.items-center.gap-2.rounded-lg.bg-bg-secondary.px-2.py-3.text-center`. Each tile has a sprite at 56/64 (`size-14 sm:size-16`) and a label `text-xs sm:text-sm leading-tight`.
- **Inline legend chips**: `div.mx-auto.w-fit.rounded-xl.bg-bg-secondary.px-4.py-3` > `ul.flex.flex-wrap.items-center.justify-center.gap-x-5.gap-y-2.5` > `li.flex.items-center.gap-1.5.text-sm`, each with a 16px sprite in a `[image-rendering:pixelated]` wrapper.
- **Boss header**:
  - 128px sprite + `p.text-lg.font-semibold` name + `p.text-xs.font-semibold.text-[#d14703]` quote.
  - Stat boxes `div.flex.flex-col.justify-center.space-y-2.rounded-xl.bg-bg-secondary.p-4.text-xs.lg:w-36`: rows of a 12px icon (in a tooltip button) + value.
- **Loot box**: `div.flex.flex-col.divide-y.rounded-xl.bg-bg-secondary.px-4.py-2`.
  - Row `div.flex.items-center.gap-2.py-3`: label `p.text-xs.font-medium` ("Común :", "Raro :") then `div.flex.min-h-[32px].items-center.gap-2` of 32px item sprites.
  - Each sprite is a `button[data-state]` that opens a tooltip with the item name.
- **Image gallery**:
  - Thumbnail strip `div.mx-auto.flex.flex-col.items-center.gap-4.rounded-xl.bg-bg-secondary.p-4.xs:w-fit` > `div.flex.items-center.justify-center.gap-2.md:gap-6`.
  - Thumbs `button.relative.flex.size-12.overflow-hidden.rounded` (48px, radius 4, `object-cover`). Selected: `span.absolute.inset-0.rounded.border-2.border-amber-600` (2px #d97706 inset frame).
  - Detail panel below `div.flex.w-full.flex-col.items-center.gap-4.rounded-xl.bg-bg-secondary.p-4`: bold title, 600x338 image, list.
  - Screenshot: `shots/state-boss-toggle-and-loot.png`.
- **Content image**: `div.relative.w-fit.shrink-0.mx-auto.my-4 > img` at 600x338 (or 800x624 for maps) with no frame, then a centered caption `div.text-center.text-sm.text-t-secondary`.

### 4.14 Tooltip (RubinOT's own; Alliance Codex replaces it)
Radix Tooltip content: `z-50 max-w-72 overflow-hidden text-wrap rounded-md bg-bg-tooltip px-2 py-1 text-center text-xs font-medium text-t-tooltip animate-in fade-in-0 zoom-in-95 data-[side=*]:slide-in-from-*-2`
- **Inverted light pill**: bg #f7f7f7, text #13161b, 12px, radius 6, padding 4px 8px, max 288px, no arrow, no border, no shadow. Default side is top. It opens after the Radix delay and animates in over 150ms.
- Content is a single line (item name, "Vinculado al personaje", "Female").
- Triggers: `button.cursor-default` wrapping a sprite or a 12px `lucide-info`.
- Screenshots: `shots/state-tooltip-info-icon.png`, `state-tooltip-loot-item.png`, `state-tooltip-outfit-sprite.png`.
- For Alliance Codex, keep the trigger mechanics (Radix, hover or focus, side top, 150ms enter) but render the in-game tooltip panel (dark panel, #E8C66A labels, white values, collapsible "Held Items: 2", compact gold bar, "Mantén Shift para fijar") instead of this pill.

### 4.15 Dialog (the "(List)" preview)
- Overlay: the same black/80 + 4px blur.
- Panel `rounded-xl border bg-bg-primary p-0.5 max-w-screen-xs` (460px) > inner `div.flex.flex-col.gap-4.rounded-[10px].border.p-4`. This is a **double border**: a 12px outer radius, a 2px gap, then a 10px inner radius, both 1px #22262f.
- Header `h2.text-center.text-base.font-semibold`, body centered (animated outfit sprite-sheets).
- No close button is visible; Esc or an outside click closes it.
- Screenshot: `shots/state-list-popover-open.png`.

### 4.16 Form controls (calculator, world transfer)
- **Text input** `input.h-9.w-full.rounded-[11px].border.border-b-secondary.bg-bg-primary.px-3.py-2.text-sm.placeholder:text-t-placeholder focus:outline-none focus:ring-0`: 36px, radius 11, 1px #22262f, padding 8px 12px. **No visible focus state.**
- **Select trigger**: same box plus a 16px chevron; placeholder color #85888e.
  - Listbox `rounded-lg bg-bg-tertiary` (#22262f, radius 8, no border), animation fade/zoom/slide 4px.
  - Viewport `p-1`. Option `rounded-sm py-1.5 pl-2 pr-9 text-sm focus:bg-bg-primary-hover` with a 16px `check` at `right-2` for the selected option.
- **Number field**: `div[role=group].h-9.rounded-xl.border.border-b-primary.bg-bg-primary` (1px #373a41) with the input `px-3 py-2 tabular-nums` and a 24px-wide stepper column of two bordered `chevron-up`/`chevron-down` 12px buttons.
- **Label** `label.text-sm.font-medium.text-t-primary` (14px, 8px above the control).
- **Checkbox** `size-4 rounded border border-b-primary bg-bg-primary`; checked `bg-amber-600 text-white border-none` with a 12px check.
- **Slider**: track `h-2 rounded-full bg-bg-tertiary`, range `bg-amber-500`, thumb `size-5 rounded-full border-2 border-amber-500 bg-bg-primary`. The value shows as `text-sm font-semibold tabular-nums text-amber-500`.
- **Stat card** `div.relative.flex.flex-col.gap-2.rounded-[11px].border.border-b-secondary.bg-bg-primary.p-4`: 20px pixelated sprite + `text-sm font-medium text-t-secondary` label, value `text-lg font-bold tabular-nums`, footnote `text-xs text-t-tertiary`.
- **Countdown/counter**: caption `p.text-xs.font-medium.uppercase.tracking-widest.text-t-tertiary`, digits `span.text-3xl.sm:text-4xl.font-bold.tabular-nums` (36/40), unit `text-xs text-t-tertiary`, separators `text-2xl sm:text-3xl font-light text-t-quaternary`.
- Screenshot: `shots/state-form-select-open.png`, `desktop-1440-tool-calculadora-de-skill-fold.png`.

### 4.17 Item / mount detail page
- **Head block** `div.flex.items-start.gap-4`:
  - Sprite at 64px (a 32px source at 2x; mounts at 128px, 2x).
  - `div.space-y-1`: name `h1.text-sm.font-bold` (14/22), stat lines `p.text-xs` (e.g. "It weighs 1.00 oz.", "Imbuing Slots: 1", "Vol: 32").
  - This mirrors the in-game "look" text. It is the natural place for the PokeAlliance card content (Required Level, Boost, Held Items …).
- **Key/value rows** `div.flex.items-center > p.text-sm.leading-8` with `span.font-bold` keys ("Botín de:", "Mercado:", "Observación:") and inline `text-link` values. Rows are 32px tall with no separators.
  - Mount variant `p.flex.flex-wrap.items-center.gap-1.text-sm.leading-6` with `strong`/`span.font-semibold` keys and inline 24px sprites.
- **Related index box** `div.mx-auto.flex.w-full.max-w-sm.flex-col.rounded-xl.border.p-2` (384 wide, centered):
  - Title `p.pb-4.pt-2.text-center.text-sm.font-bold`.
  - Group header `div.rounded.bg-bg-secondary.py-2 > p.text-center.text-xs.font-bold`.
  - `grid grid-cols-2 gap-2` of links `a.flex.items-center.gap-3.p-2.hover:underline` (32px sprite + `text-sm`). The right column is mirrored (`justify-end`, sprite after the text); disabled entries use `text-t-disabled cursor-not-allowed`.

---

## 5. Sprites and image rendering
- All sprites are `next/image` `<img loading="lazy" style="color:transparent" class="shrink-0 opacity-100 transition-opacity duration-300">` in a `div.relative.w-fit.shrink-0` wrapper.
  - While loading, an overlay `div.absolute.inset-0.animate-pulse.rounded.bg-gray-200.dark:bg-gray-700` shows and the image sits at `opacity-0`. It fades in over 300ms.
- Display sizes used: 12 (stat icons), 16 (nav, index links, chips, legends), 20 (timeline nodes, calculator stat), 24 (panel headers, info-card titles, palette items, table rewards), 32 (loot, segmented buttons, horn), 48 (category table, gallery thumbs), 64 (detail head, race tiles), 128 (mount/boss detail).
- Scaling is inconsistent. Many 32px GIFs are downscaled to 16 or 24, and some are upscaled 1.5x or 2x.
  - `image-rendering` is **auto** (smoothed) on plain `<img>`. Only the sprite-sheet component and a few wrappers (`[image-rendering:pixelated]`) are pixelated.
  - Alliance Codex should render integer scales (1x/2x) with `image-rendering: pixelated`.
- Decorative motion: `animate-smooth-bounce duration-5000` (a 5s loop that lifts 3px at 25% and 75%) on the pinned nav sprites and the Destacados cards. Nothing else animates.
- **Sprite-sheet component** (CSS module `sprite-sheet-from-url_root`, file `data/c.css`):
  ```css
  .root{flex-shrink:0;width:var(--sprite-frame-w);height:var(--sprite-frame-h);
    background-image:var(--sprite-url);background-repeat:no-repeat;background-position:0 0;
    background-size:var(--sprite-strip-w) var(--sprite-frame-h);
    image-rendering:crisp-edges;image-rendering:pixelated;
    animation:spriteSheetShift var(--sprite-duration,1s) steps(var(--sprite-frame-count,1)) infinite}
  @keyframes spriteSheetShift{0%{background-position:0 0}to{background-position:calc(-1*var(--sprite-strip-w)) 0}}
  @media (prefers-reduced-motion:reduce){.root{animation:none}}
  ```
  Example: `--sprite-frame-w:64px; --sprite-frame-h:64px; --sprite-strip-w:2048px; --sprite-frame-count:32; --sprite-duration:3.2s`. The source is a horizontal strip served by an outfit proxy.
  It only supports **uniform** frame durations. The Alliance Codex requirement (real Diamond sheet, 7 frames with per-frame durations, plus fixed-variant frames by quantity) needs generated keyframes with per-frame percentages or a JS stepper. The CSS-variable API above is a good base.

## 6. States, focus, scrollbars
- **Hover**: one background (#22262f) for sidebar items, header buttons, search triggers, cards, index links, segmented buttons, social icons and footer icons.
  - Some links add a text change: index links go from #cecfd2 to #f7f7f7, social icons from #94979c to #f7f7f7.
  - Text links only underline.
  - Destacados arrow: 2px nudge and a color change.
  - No hover state on table rows or sort headers.
- **Focus**: global `:focus-visible { outline: 2px solid #a4bcfd; outline-offset: 1px }`, and in dark `outline-color: #444ce7` (indigo).
  - Inputs, selects and the palette input suppress it (`focus:outline-none focus:ring-0`), so they have no visible focus. Alliance Codex must keep a visible focus there.
- **Selected**: palette item bg #13161b; select option check icon; tabs filled with the tier color; toggles with an amber-600 border and ring; gallery thumbs with an amber-600 2px frame; checkbox amber-600 fill.
- **Disabled**: #85888e text, `cursor-not-allowed`, sprite `opacity-40`.
- **Scrollbars**:
  - Page, table and palette areas use Radix ScrollArea: track 8px (`w-2 p-0.5 border-l border-l-transparent`), thumb `rounded-full bg-gray-500` about 3px wide, #85888e. The native scrollbar is hidden.
  - The sidebar hides its scrollbar and uses the 80px mask fade.
  - A `.beautiful-scrollbar` utility (8px, thumb #6b7280/#9ca3af, 2px transparent border) exists in the CSS.
- **Light theme** exists (theme toggle, `html.light`). See `shots/desktop-1440-home-LIGHT-theme-fold.png`. Tokens are in section 0.

## 7. Responsive behavior (390)
- The header keeps the logo on the left. On the right: search icon (inner pages) | 1px separator | theme toggle | separator | hamburger. The language select moves into the sheet.
- Content padding is 16px each side (358px column) with the same 48px vertical rhythm.
- Home:
  - The logo image is hidden and the intro stacks (h1, subtitle, then socials).
  - The search trigger is hidden.
  - Destacados becomes 1 column (cards 358x62).
  - Index panels are full width; the worlds table goes below them.
- Title: h1 stays 30px. The parenthetical h2 is hidden below 460.
- Info banner: the facts stack vertically (8px gap), the sprite stays on the left and the "|" separators are hidden.
- Info cards go full width. Segmented buttons use 1 column below 460 and 2 from 460.
- Tables keep their fixed min widths (e.g. 920px) and scroll horizontally inside the ScrollArea, with a thin thumb below.
- The right rail disappears (no TOC on mobile).
- Screenshots: `shots/mobile-390-*.png`.

## 8. What RubinOT does NOT do (keep it that way)
- **No hero**: no slogan, tagline, kicker, marketing paragraph or big CTA. The home opens with a 16px h1 and a one-line 12px description next to the logo.
- **No gradients** on surfaces, text or buttons. The only gradients are the black image overlay on banner images, the sidebar scroll mask and the timeline dash pattern.
- **No shadows or elevation** on cards, panels, tables, dialogs or dropdowns. Depth comes from three flat grays (#0c0e12, #13161b, #22262f) and 1px #22262f borders.
- **No brand accent color in the UI chrome.** The indigo "brand" tokens are defined but unused. Color comes only from content: sprites, the red info banner, amber selection and tier colors.
- **No icon-set icons for navigation or entities.** Lucide is limited to utility glyphs (search, chevrons, globe, moon/sun, menu, x, arrows, info, check, external-link). Every nav entry, card, panel header, chip, timeline node, tab and callout uses a game sprite.
- **No uppercase or letter-spaced labels** except "DESTACADOS" and one calculator caption. No eyebrow text above headings.
- **No card hover lift, scale or glow.** Only a background change.
- **No pills for buttons.** Radii stay 8–12px; `rounded-full` is only for chips and the slider.
- **No large type.** The biggest text is the 30px page title (36px counter digits in the tool). Section titles are 20px. Nearly all UI text is 12–14px, which keeps the layout dense.
- **No max-width on prose.** Paragraphs are justified across the full column.
- **No fake metrics, badges or decorative counters.** The only counters are real link counts in index panels and live player counts in the worlds table.
- **No footer on home.** Inner pages get a single slim footer bar.
- **No active nav state, no TOC scroll-spy, no ARIA on tab-like buttons and no visible focus on inputs.** These are gaps. Alliance Codex should fix them while keeping the same visuals.
- **No self-hosting of licensed fonts for us.** RubinOT self-hosts Microsoft Verdana files, which is an EULA issue. Alliance Codex should use a local stack instead: `font-family: Verdana, "DejaVu Sans", "Bitstream Vera Sans", Tahoma, Geneva, sans-serif`. Inter (OFL) can be self-hosted.

## 9. Mapping notes for Alliance Codex (design language only)
- Shell, sidebar, breadcrumbs, title + parenthetical, h2 + divider, index panels, Destacados cards, tables, timeline, chips, notes, info banner, palette and footer: copy them 1:1 with the tokens above.
- Replace the promo card in the rail with nothing, or with a factual block (e.g. data freshness). Do not write marketing copy.
- Replace the Radix white-pill tooltip with the in-game tooltip panel (same trigger mechanics: hover or focus, side top, about 150ms enter, Shift to pin).
- Lista view = RubinOT data table (4.11). Cards view = detail head block (4.17) laid out as `rounded-xl border` cards. Slots view = the 32px sprite rows of the loot box (4.13), with a `rounded-lg bg-bg-secondary` slot per entity.
- Put PokeAlliance sprites wherever RubinOT puts sprites: nav (16px), index panel headers (24px), Destacados (32px), banner (64x32 slot), timeline nodes (20px), chips (16px), tabs (32px).

---

## 10. Screenshot index
Base: `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/rubinot/shots/`

The `-fold` files show the first 900px. The `-full` files show the whole scroll content (viewport grown to the content height, so the sidebar also appears fully expanded).

Desktop 1440:
- `desktop-1440-home-fold.png`, `desktop-1440-home-full.png`: home (Destacados, index panels, worlds table).
- `desktop-1440-home-LIGHT-theme-fold.png`: light theme.
- `desktop-1440-system-battle-pass-fold.png` / `-full.png`: system page (breadcrumb, title + parenthetical, image banner grid, video embed, rail with promo only, footer).
- `desktop-1440-subpage-battle-pass-temporada-01-fold.png` / `-full.png`: sub page (red info banner, centered info cards, bullets, timeline + chips, segmented tabs, rewards table, TOC "Resumen").
- `desktop-1440-subpage-battle-pass-season-05-current-fold.png` / `-full.png`: current season (more tables, projections).
- `desktop-1440-item-category-backpacks-fold.png` / `-full.png`, `desktop-1440-item-category-chests-*.png`: item category tables.
- `desktop-1440-item-detail-blessed-dwarven-backpack-*.png`: item detail (no rail, related index box).
- `desktop-1440-mount-category-monturas-*.png`, `desktop-1440-mount-detail-emberwyrm-*.png`: mounts.
- `desktop-1440-tables-guild-ascension-*.png`: many tables, notes, race tiles, element legend.
- `desktop-1440-timeline-castillo-*.png`: time-based timeline, map image, prize table.
- `desktop-1440-form-world-transfer-*.png`: inputs, select, helper text.
- `desktop-1440-tool-calculadora-de-skill-*.png`: calculator (number fields, slider, checkboxes, stat cards, counter).
- `desktop-1440-event-halloween-2025-*.png`: story box, boss toggle, stat boxes, loot rows, image gallery.
- `desktop-1440-tabs-sistema-de-drops-*.png`: season selector grid.
- `desktop-1440-video-prestige-arena-*.png`, `desktop-1440-linked-tasks-*.png`, `desktop-1440-cosmetic-card-*.png`, `desktop-1440-house-thrones-*.png`.
- `desktop-1920-home-fold.png`, `desktop-1920-subpage-temporada-01-fold.png`: wide layout.

Mobile 390:
- `mobile-390-home-fold.png` / `-full.png`, `mobile-390-system-battle-pass-*.png`, `mobile-390-subpage-battle-pass-temporada-01-*.png`, `mobile-390-item-category-backpacks-*.png`, `mobile-390-item-detail-blessed-dwarven-backpack-*.png`, `mobile-390-mount-detail-emberwyrm-*.png`, `mobile-390-timeline-castillo-*.png`.
- `mobile-390-menu-open.png`: right sheet nav.
- `mobile-390-palette-open.png`: palette on mobile.

States (1440):
- `state-palette-open-empty.png`, `state-palette-query-backpack.png`, `state-palette-query-arrow-selected.png`.
- `state-sidebar-expanded.png`, `state-sidebar-sistemas-collapsed.png`, `state-sidebar-all-collapsed.png`, `state-sidebar-link-hover.png`.
- `state-destacados-card-hover.png`, `state-season-banner-hover.png`.
- `state-keyboard-focus.png` (indigo focus outline).
- `state-language-select-open.png`, `state-form-select-open.png`.
- `state-tooltip-info-icon.png`, `state-tooltip-loot-item.png`, `state-tooltip-outfit-sprite.png`.
- `state-list-popover-open.png` (double-border dialog).
- `state-segmented-tabs-selected.png` (tier-colored tab + tier column table).
- `state-boss-toggle-and-loot.png` (loot rows, notes, gallery).
- `state-table-sorted-by-date.png`.
- `state-right-rail-hidden-wide-content.png` (layout toggle).
