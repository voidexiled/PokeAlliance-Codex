# Corte 0 technical plan: the "Codex Tooltip" design system

The plan is below. It is based on the working tree at the time of reading, and I modified no repo files. Every file:line refers to that working tree, not to HEAD. About 50 files currently have uncommitted changes, so commit the owner's in-flight work first, then branch Corte 0 from that commit.

My analysis scripts and outputs are in `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/corte0/`:

| File | What it holds |
|---|---|
| `analyze.cjs` | The postcss parser that produced the files below |
| `structure.json` | Top-level layout of each CSS file |
| `custom-props.json` | Every custom property definition |
| `var-uses.json` | How often each custom property is used |
| `literals.json` | Colour literals per file |
| `duplicates-by-layer.tsv` | The 171 duplicated classes, with every line and layer |
| `dup-live.txt` | The 104 duplicated classes that are still used |
| `dead-classes-final.tsv` | The 114 dead classes, with every definition line |
| `legacy-possibly-live.tsv` | The 130 legacy declarations that nothing identical overrides |
| `selfdup-*.tsv` | Selectors repeated inside the same file |
| `shadow.cjs` | The script that finds overridden declarations |
| `literal-budget.mjs` | Prototype of the colour-literal budget check |
| `contrast.mjs` | The token contrast table |

## 0. Corrections to the earlier audit

- **`@layer legacy-wiki` is `global.css:2440-3241`,** not 2440-3364.
  - The comment above it is at `:2438-2439`.
  - `global.css:3243-3364` is **unlayered** Guild CSS (guild-lifecycle, guild-membership, guild-member-progress). Every class in it is dead.
- **171 classes are defined in both `global.css` and `wiki-reference.css`,** not 165. I collected them with a postcss selector parse.
  - 67 of them are dead.
  - 104 are live: 43 shell, 17 map, 9 tools and 35 Guild.
- **Same-file repeats also exist:** 123 selectors in `wiki-reference.css`, 45 in `global.css` and 65 in `trade.css` are defined twice or more in the same media context.
- **The live cascade order** in `dist/client/_astro/AppLayout.CIzFFVUb.css` is: `properties`, `theme`, `base`, `components`, `utilities`, `legacy-wiki`, then unlayered CSS.
  - That bundle is 197,352 bytes raw and 34,269 bytes gzipped, and every page loads it.
- **Seven components have no importers:**
  - `phase3/ReadinessPanel.tsx`
  - `phase3/RoutePlaceholder.astro`
  - `wiki/RecordCard.astro`
  - `wiki/WikiPortalPanel.tsx`
  - `wiki/WikiSourceCard.tsx`
  - `wiki/DataStatus.astro`
  - `wiki/EvidenceTrail.astro`

  As a result `ui/card.tsx` and `ui/separator.tsx` have no live importers either.
- **Colour literals outside token files total 697** (comments excluded):

  | File | Literals |
  |---|---|
  | `global.css` | 394 |
  | `wiki-reference.css` | 146 |
  | `trade.css` | 95 |
  | `home.css` | 29 |
  | `guides.css` | 21 |
  | `lib/tools/guild-ranking-image.ts` | 11 |
  | `AppLayout.astro` | 1 |

---

## A. Target CSS architecture

### A1. Files

```
src/styles/
  global.css            entry point, the only CSS that AppLayout.astro:2-3 imports (wiki-reference.css import removed)
  tokens.css            :root custom properties only; one of the only 2 CSS files allowed colour literals
  theme.css             @custom-variant dark + @theme / @theme inline (Tailwind mapping)
  base.css              layer(base): html/body, focus, selection, link colour, h1 voice, reduced motion, forced colours
  motion.css            unlayered: @view-transition + ::view-transition-* + @keyframes cx-*
  shell.css             layer(components): topbar, sidebar, mobile nav, breadcrumbs, page header, panel, prose, toc, table, data rows, notice, skip link
  game-layer.css        layer(game): .cx-unit .cx-stats .cx-meter .cx-section .cx-slot .cx-money .cx-ball .cx-skeleton
  domain/palettes.css   :root / [data-type] domain colours (--dex-*, --pokemon-type*, --ball-accent); the second literal-allowed file
  domain/pokedex.css    layer(domain), imported by pokedex/index.astro and pokedex/[slug].astro   (from wiki-reference.css:1734-3201)
  domain/guild.css      layer(domain), imported by herramientas/guild.astro                       (global.css:1395-2210,2343-2434 + wiki-reference.css:3203-5496)
  domain/map.css        layer(domain), imported by mapa/index.astro and mapa/aportar.astro         (global.css:685-1132 + wiki-reference.css:1333-1457)
  domain/tools.css      layer(domain), imported by herramientas/pokemon.astro                      (global.css:1134-1393 + wiki-reference.css:1459-1575)
  domain/home.css, domain/guides.css, domain/trade.css    replace the current home.css, guides.css and trade.css
src/lib/design/tokens.ts  TS mirror of the colour tokens for canvas/PNG export and theme-color; the only TS file allowed literals
```

`wiki-reference.css` is deleted once its rules have been split out.

### A2. `global.css` (the whole file)

```css
@layer properties, theme, base, components, game, domain, utilities;
@import 'tailwindcss';
@import './tokens.css';
@import './theme.css';
@import './base.css' layer(base);
@import './shell.css' layer(components);
@import './game-layer.css' layer(game);
@import './motion.css';
```

- `tw-animate-css` (`global.css:2`) goes. It is only used at `ui/dialog.tsx:29,51` and `ui/dropdown-menu.tsx:41,138`. Replace those with base-ui `data-starting-style` / `data-ending-style` transitions, which `ui/sheet.tsx:31,56` already uses.
- Every `domain/*.css` file starts with the same `@layer properties, theme, …, utilities;` statement. The layer order then holds whatever order Vite emits the chunks in.
- If Tailwind's import resolver rejects `layer()`, wrap each file's body in `@layer x { }` instead.

### A3. Layer order

The order is `properties < theme < base < components (shell) < game < domain < utilities`.

- `properties` goes first because Tailwind emits `@layer properties{…}` first. If it were declared after `utilities` it would outrank them.
- Tailwind utilities stay last, so `className` overrides always win.
- Domain CSS can adjust game components in context, such as the Pokédex infobox placement.
- Only custom properties, `@font-face` (from Astro's `<Font>`) and `motion.css` are unlayered. `@view-transition` is kept outside `@layer`.
- There is **no unlayered component CSS and no `!important`.**
  - Today there are 5 `!important`: `wiki-reference.css:846, 3784, 4159, 4853, 4854`.
  - Inside layers, `!important` inverts: an earlier layer's important declaration beats a later one's.

### A4. `tokens.css`

```css
:root{
  --cx-canvas:#0f1318;--cx-surface:#161b22;--cx-card:#1d232b;--cx-raised:#262b32;--cx-recess:#12161c;
  --cx-line:#2e3540;--cx-line-strong:#646d7c;
  --cx-value:#fefefe;--cx-copy:#eef0f3;--cx-copy-2:#b6bcc6;--cx-muted:#8a919c;
  --cx-gold:#e8c66a;--cx-gold-ink:#1a1506;--cx-blue:#3aa6f6;--cx-blue-hi:#68c0ff;--cx-blue-ink:#0b1a2b;
  --cx-train:#4caf50;--cx-train-track:#2c2c2c;--cx-bar-track:#343b46;--cx-success:#4ade80;--cx-danger:#f87171;
  --cx-scrim:rgb(8 10 14/.72);--cx-selection:rgb(58 166 246/.35);
  --cx-e1:0 6px 16px rgb(0 0 0/.28);--cx-e2:0 12px 32px rgb(0 0 0/.45);
  --cx-font-ui:var(--font-inter,system-ui,sans-serif);--cx-font-game:var(--font-poppins,system-ui,sans-serif);
  --cx-font-code:ui-monospace,'Cascadia Mono',SFMono-Regular,Consolas,monospace;
  --cx-d1:90ms;--cx-d2:140ms;--cx-d3:200ms;--cx-d4:260ms;--cx-d5:320ms;--cx-exit:.7;
  --cx-ease-out:cubic-bezier(.22,1,.36,1);--cx-ease-in:cubic-bezier(.4,0,1,1);
  --cx-r-slot:4px;--cx-r-control:6px;--cx-r-card:8px;--cx-r-panel:12px;
  --cx-shell-topbar:4rem;--cx-shell-sidebar:13rem;--cx-shell-rail:13rem;--cx-shell-max:96rem;--cx-shell-gap:2.5rem;--cx-gutter:1rem;--cx-target:2.5rem;
  --cx-z-topbar:40;--cx-z-overlay:50;--cx-z-popover:60;--cx-z-toast:70;
  /* shadcn semantic aliases (kept so ui/* and future `shadcn add` still work) */
  --background:var(--cx-canvas);--foreground:var(--cx-copy);--card:var(--cx-surface);--card-foreground:var(--cx-copy);
  --popover:var(--cx-card);--popover-foreground:var(--cx-copy);--primary:var(--cx-blue);--primary-foreground:var(--cx-blue-ink);
  --secondary:var(--cx-raised);--secondary-foreground:var(--cx-copy);--muted:var(--cx-raised);--muted-foreground:var(--cx-copy-2);
  --accent:var(--cx-raised);--accent-foreground:var(--cx-value);--destructive:var(--cx-danger);
  --border:var(--cx-line);--input:var(--cx-line-strong);--ring:var(--cx-blue-hi);
}
```

Notes on these values:
- **`--cx-blue-ink`** is the only token I added beyond the approved set. White on blue measures 2.61:1 and fails; blue-ink on blue measures 6.65:1.
- **`--cx-yellow`, `--cx-gold-tint` and the diamond/kk/fiat tints are left out.** Selection is blue, and the currency tints wait for Corte 1 assets.
- **The z scale gives the topbar 40 and overlays 50.** Today the topbar (`wiki-reference.css:50`) and the dialogs (`ui/dialog.tsx:29,51`) are both z 50.

### A5. `theme.css` (Tailwind 4.3.3)

```css
@custom-variant dark (&:where(.dark, .dark *));
@theme {
  --color-*: initial;                       /* no default palette: every colour is a token */
  --text-*: initial;
  --text-xs:.75rem; --text-xs--line-height:1rem;             /* 12 = floor */
  --text-row:.8125rem; --text-row--line-height:1.3125rem;    /* 13/21 = in-game stat row */
  --text-sm:.875rem; --text-sm--line-height:1.25rem;         /* 14 */
  --text-base:1rem; --text-base--line-height:1.5rem;         /* 16 */
  --text-xl:1.25rem; --text-xl--line-height:1.75rem;         /* 20 */
  --text-2xl:1.5rem; --text-2xl--line-height:2rem;           /* 24 */
  --text-display:clamp(1.75rem,3vw,2.5rem); --text-display--line-height:1.1;
  --radius-*: initial; --radius-sm:4px; --radius-md:6px; --radius-lg:8px; --radius-xl:12px;
  --shadow-*: initial; --inset-shadow-*: initial; --drop-shadow-*: initial; --text-shadow-*: initial; --blur-*: initial;
  --breakpoint-*: initial; --breakpoint-sm:40rem; --breakpoint-md:48rem; --breakpoint-lg:64rem; --breakpoint-xl:80rem;
  --ease-*: initial;
}
@theme inline {
  --font-sans:var(--cx-font-ui); --font-heading:var(--cx-font-ui); --font-game:var(--cx-font-game); --font-mono:var(--cx-font-code);
  --color-background:var(--background); --color-foreground:var(--foreground); --color-card:var(--card); --color-card-foreground:var(--card-foreground);
  --color-popover:var(--popover); --color-popover-foreground:var(--popover-foreground); --color-primary:var(--primary); --color-primary-foreground:var(--primary-foreground);
  --color-secondary:var(--secondary); --color-secondary-foreground:var(--secondary-foreground); --color-muted:var(--muted); --color-muted-foreground:var(--muted-foreground);
  --color-accent:var(--accent); --color-accent-foreground:var(--accent-foreground); --color-destructive:var(--destructive);
  --color-border:var(--border); --color-input:var(--input); --color-ring:var(--ring);
  --color-canvas:var(--cx-canvas); --color-surface:var(--cx-surface); --color-game:var(--cx-card); --color-raised:var(--cx-raised); --color-recess:var(--cx-recess);
  --color-line:var(--cx-line); --color-line-strong:var(--cx-line-strong); --color-value:var(--cx-value); --color-copy:var(--cx-copy); --color-copy-2:var(--cx-copy-2);
  --color-hint:var(--cx-muted); --color-link:var(--cx-blue-hi); --color-blue:var(--cx-blue); --color-blue-ink:var(--cx-blue-ink);
  --color-gold:var(--cx-gold); --color-gold-ink:var(--cx-gold-ink); --color-train:var(--cx-train); --color-train-track:var(--cx-train-track);
  --color-bar-track:var(--cx-bar-track); --color-success:var(--cx-success); --color-danger:var(--cx-danger); --color-scrim:var(--cx-scrim);
  --shadow-e1:var(--cx-e1); --shadow-e2:var(--cx-e2);
  --ease-out:var(--cx-ease-out); --ease-in:var(--cx-ease-in);
  --default-transition-duration:var(--cx-d2); --default-transition-timing-function:var(--cx-ease-out);
}
```

**Radius.** Tailwind's sm/md/lg/xl already equal 4/6/8/12, so `rounded-md` means control, `rounded-lg` card and `rounded-xl` panel. Bars use `rounded-none`.

**Spacing.** Keep Tailwind's 4px `--spacing`. In hand-written CSS use `calc(var(--spacing)*n)`.

**Duration.** Tailwind 4 has no duration namespace. Use `duration-90/140/200/260/320` in className, and `var(--cx-dN)` in CSS.

**What the reset breaks.** These must change in the same PR:
- `text-lg` at `ServerSaveStatus.tsx:42` and `rotaciones/index.astro:72`.
- `bg-black/10` at `ui/dialog.tsx:29` and `ui/sheet.tsx:31`.
- `shadow-sm` at `ui/tabs.tsx:51`, `shadow-md` at `ui/dropdown-menu.tsx:41`, `shadow-lg` at `ui/dropdown-menu.tsx:138` and `ui/sheet.tsx:56`.
- `backdrop-blur-xs` at `ui/dialog.tsx:29` and `ui/sheet.tsx:31`.
- Dead code only: `shadow-2xl shadow-black/10` at `ReadinessPanel.tsx:95`.

Tailwind drops unknown utilities silently, so `check-tokens` greps for them (C9).

### A6. Dark variant

- **The site is dark-only.**
  - Set `<html lang={locale} class="dark">` (`AppLayout.astro:89`) and add `<meta name="color-scheme" content="dark">`.
  - Set `theme-color` to the canvas (`AppLayout.astro:94`, today `#111318`), reading the value from `lib/design/tokens.ts`.
  - Keep `color-scheme: dark` (`global.css:67`) in `base.css`.
- **`@custom-variant dark` stays for good,** so future shadcn components behave the same on any OS.
- **All 24 current `dark:` uses in `ui/*` collapse into their dark value, and the base class is removed.** The count per file:

  | File | Lines | `dark:` count |
  |---|---|---|
  | `badge.tsx` | 7, 14, 16 | 3 |
  | `button.tsx` | 6, 12 (3), 16, 18 (2) | 7 |
  | `dropdown-menu.tsx` | 90 | 1 |
  | `input.tsx` | 11 | 1 |
  | `kbd.tsx` | 8 | 1 |
  | `tabs.tsx` | 51 (2), 52 (2), 53 (3) | 7 |
  | `textarea.tsx` | 9 | 4 |

- **Remove the fake "Tema oscuro" indicator** at `AppLayout.astro:149-155`.

### A7. Hard rules, enforced by `check-tokens` (C9)

- Colour literals may appear only in `tokens.css`, `domain/palettes.css` and `lib/design/tokens.ts`.
- `--cx-gold` / `text-gold` / `bg-gold` may appear only in `game-layer.css`, `ui/button.tsx` (the `cta` variant) and the wordmark.
- No font-size below 12px.
- No `backdrop-filter`, no `background-clip:text`, no `!important`.
- Media query widths only at 40, 48, 64 or 80rem.
  - There are 17 distinct max-widths today: 390, 560, 600, 639, 640, 680, 760, 767, 800, 900, 980, 1023, 1099, 1100, 1199, 1279, 1399.
  - Remap them to the nearest band.
- Numbers use `tabular-nums` Inter. `--cx-font-code` is only for IDs and coordinates.
  - There are 85 `var(--font-code)` uses to triage.
  - `font-mono` counts must become Inter tabular: `guias/index.astro:77,135`, `sistemas/index.astro:73,93`, `ServerSaveStatus.tsx:42,46,49`, `ContentSearch.tsx:101`.

---

## B. Old to new token map

### B1. shadcn variables (`global.css:32-56`) and `@theme inline` (`global.css:4-29`)

| Old | Value | New |
|---|---|---|
| `--font-body` / `--font-display` | Verdana | `--cx-font-ui` / `--cx-font-game`, then **delete** |
| `--font-code` | Cascadia | `--cx-font-code` |
| `--background` | #0c0e12 | `var(--cx-canvas)` |
| `--foreground` | #f7f7f7 | `var(--cx-copy)` |
| `--card` | #0c0e12 | `var(--cx-surface)` |
| `--card-foreground` | #f7f7f7 | `var(--cx-copy)` |
| `--popover` | #13161b | `var(--cx-card)` + `shadow-e2` |
| `--popover-foreground` | #f7f7f7 | `var(--cx-copy)` |
| `--primary` | #f7f7f7 | `var(--cx-blue)` |
| `--primary-foreground` | #0c0e12 | `var(--cx-blue-ink)` |
| `--secondary` / `--muted` | #13161b | `var(--cx-raised)` |
| `--secondary-foreground` | #cecfd2 | `var(--cx-copy)` |
| `--muted-foreground` | #94979c | `var(--cx-copy-2)`, **not** `--cx-muted`. Muted on raised is 4.48:1 and fails, and `bg-muted text-muted-foreground` appears together at `ui/tabs.tsx:17,21`. |
| `--accent` | #93c5fd | `var(--cx-raised)`. First replace the 17 link-colour uses of `var(--accent)` in `global.css` (138, 287, 297, 470, 498, 501, 559, 582, 608, 664, 736, 1158, 1242, 2258, 3339…) with `--cx-blue-hi`. Replace `text-accent` at `mapa/aportar.astro:190` and `mapa/index.astro:56` with `text-link`, and `hover:border-accent/60` at `ContentSearch.tsx:111` with `hover:border-line-strong`. |
| `--accent-foreground` | #0c0e12 | `var(--cx-value)` |
| `--destructive` | #f97066 | `var(--cx-danger)` |
| `--border` | #22262f | `var(--cx-line)` |
| `--input` | #373a41 | `var(--cx-line-strong)` |
| `--ring` | #444ce7 (3.16:1) | `var(--cx-blue-hi)` (9.38:1 on canvas) |
| `--signal`, `--color-signal` | #47cd89 | **delete**. Its only uses are `global.css:221` (dead `.status-dot`) and ServerSaveStatus, which moves to `text-success`. |
| `--panel`, `--panel-strong`, `--color-panel*` | | **delete**. Uses: `global.css:3254` (dead) and `bg-panel` in the dead `ReadinessPanel.tsx:95,130`. |
| `--link` | #93c5fd, 0 uses | **delete** in favour of `--color-link` |

### B2. `--wiki-*` (`wiki-reference.css:8-32`)

These become temporary aliases in `tokens.css`, then a codemod removes them (I4).

| Old | New |
|---|---|
| `--wiki-sidebar-width` | `--cx-shell-sidebar` |
| `--wiki-balancing-rail-width` | `--cx-shell-rail` |
| `--wiki-content-max` | `--cx-shell-max` |
| `--wiki-topbar-height` | `--cx-shell-topbar` |
| `--wiki-shell-gap` | `--cx-shell-gap` |
| `--wiki-page-bg` | `--cx-canvas`, including the SVG fill at `AllianceWordmark.astro:21` |
| `--wiki-surface` | `--cx-surface` |
| `--wiki-surface-secondary` (18 uses) | Two roles, see below |
| `--wiki-hover` (16 uses) | `--cx-raised` |
| `--wiki-line` | `--cx-line` |
| `--wiki-line-strong` (23 uses) | `--cx-line-strong` for control boundaries and `--cx-line` for decorative lines, decided per use. The value jumps from #373a41 to #646d7c. |
| `--wiki-copy` | `--cx-copy` |
| `--wiki-copy-secondary` | `--cx-copy-2` |
| `--wiki-copy-tertiary` | `--cx-muted` |
| `--wiki-copy-disabled` | `--cx-muted` |
| `--wiki-copy-quinary` (#61656c, 3.3:1, fails) | `--cx-muted` |
| `--wiki-link` | `--cx-blue-hi` |
| `--wiki-focus` | `--cx-blue-hi` |
| `--wiki-success` | `--cx-success` |
| `--wiki-error` | `--cx-danger` |
| `--wiki-brand-gold` | See below |
| `--wiki-brand-blue` | `--cx-blue` (`AllianceWordmark.astro:26`) |
| `--wiki-radius-panel` | `--radius-xl` |
| `--wiki-radius-control` (8px) | `--radius-md` (**6px**) |
| `--wiki-radius-item` | `--radius-md` |

**`--wiki-surface-secondary` splits by role:**
- Bands become `--cx-recess`: `.wiki-panel-header :573`, kbd `:710`, `.map-legend :1363`, `.map-map-controls :1453`, zebra rows `:1570`, `.guild-historical-banner :3317`, `.guild-auth-mode-tabs :4311`, `.guild-summary-heading :4568`, `:4652`, `thead :4755`.
- Active or floating states become `--cx-raised` / `--cx-card`: `.wiki-topbar-search:focus-within :192`, `.guild-status-strip [data-active] :3396`, `.guild-history-table [data-active] :3675`, `.guild-tool-sheet :3723` (card), `.guild-table-action :1466, :4374`.
- Two uses are dead: `:913`, `:1008`.

**`--wiki-brand-gold` splits by role:**
- The wordmark (`:83, :110`) becomes `--cx-gold`.
- The topbar search focus (`:191`) becomes `--cx-blue-hi`.
- The Guild CTA (`:3307-3308`) becomes the `cta` Button.
- The premium band (`:3552-3553`, `:4525`, `:4818`) becomes neutral text plus an icon, because gold is never a state.
- Dead uses: `:786`, `:927`.

### B3. `@layer legacy-wiki :root` (`global.css:2441-2451`)

All of it is deleted:
- `--wiki-sidebar-width` 248px, `--wiki-topbar-height` 58px, `--wiki-page-bg` #090b0e, `--wiki-surface` #0d1014, `--wiki-line` #1e252c, `--wiki-line-strong` #28313a and `--wiki-copy` #d8dde2 are already overridden by the unlayered `wiki-reference.css:8-32`.
- `--wiki-surface-raised` (#12161b) is used only at `:2650, :2983, :3130`, which are legacy or dead rules.
- `--wiki-accent` (#d7a05d) is used at `:2581` (sidebar current border, possibly live, see C1) and at `:2593, :2605, :2676, :3074, :3142` (dead).

### B4. `--trade-*` (`trade.css:705-710`)

| Old | New |
|---|---|
| `--trade-panel` #252a2e | `--cx-card` |
| `--trade-recess` #1b2024 | `--cx-recess` |
| `--trade-line` #3b4246 | `--cx-line`, or `--cx-line-strong` on controls |
| `--trade-gold` #f3cc62 | `--cx-gold` |
| `--trade-copy` #f3f3ee | `--cx-value` |
| `--trade-muted` #afb7b8 | `--cx-copy-2` |

All six are deleted afterwards.

### B5. Domain tokens

- **Keep, and move to `domain/palettes.css`:**
  - `--dex-red`, `--dex-red-dark`, `--dex-amber`, `--dex-paper` (`wiki-reference.css:1746-1750`).
  - `--pokemon-type` / `--pokemon-type-surface`: the base at `:1752-1753` and 18 type palettes at `:2387-2458`.
  - `--ball-accent` (`:2764, :2780, :2784, :2788`).
- **Delete** the unused `--dex-screen` (`:1749`) and `--dex-ink` (`:1751`).
- **Delete** `--home-pokemon-color` (`home.css:155, 171, 175, 179`). It duplicates the type palette, so use `--pokemon-type`.
- **`--card-spacing`:** the definitions at `global.css:2972, 3120` and `wiki-reference.css:902, 997` belong to dead classes and are deleted. The inline one in `card.tsx:14` stays.

### B6. Gold literals

There are at least 9 golds today. All collapse to `--cx-gold`, except the Pokédex's own `--dex-amber`:
- `trade.css:708, 823, 969`
- `home.css:39, 85`
- `trade.css:19`
- `global.css:2451`
- `wiki-reference.css:28`

Other literal fixes:
- The stray `::selection #3730a3` (`global.css:83`) becomes `--cx-selection`.
- The gold focus halos (`global.css:173, 737, 1619, 2508`) and the gold outline at `trade.css:989` become the `--cx-blue-hi` outline.

---

## C. Deletion plan

**C0. Build the harness before deleting anything.** Everything in C runs against it (see G5).

It is a Playwright capture/compare spec (`tests/e2e/style-freeze.spec.ts`, which only runs when `STYLE_FREEZE=capture|compare`):
- Routes: the 28 routes from `smoke.spec.ts:205-223`, plus the Guild route with its fixture loaded.
- Widths: 375, 480, 580, 620, 660, 720, 780, 850, 940, 1000, 1060, 1150, 1240, 1340, 1440 and 2518. These fall between every current breakpoint.
- What it records: `getComputedStyle` for every element under `body`, keyed by its DOM path.
  - Properties: display/position/inset, box size (rounded to 0.5), margin, padding, gap, grid and flex, all font properties, color, background, border width/style/colour/radius, box-shadow, outline, opacity, transform, overflow, z-index, transition.
  - States: focus-visible on the first 30 tabbable elements and hover on shell links.
- **Every step C1-C7 must show a zero diff.**

**C1. Delete `@layer legacy-wiki`: `global.css:2438-3241`.**

The static analysis (`shadow.cjs`) splits its 418 declarations into three groups:
- 288 are overridden by an identical selector and property with the same or broader media. They can be deleted safely.
- 85 sit on dead selectors.
- About 45 on live selectors are not overridden by an identical selector. They are listed below. The harness decides each one: if it wins today, fold it into the merged rule in PR1 and remove it deliberately in PR2.

The possibly-live declarations:
- `:2460` `.wiki-topbar` border-bottom-color
- `:2465` `.wiki-topbar-inner` grid-template-columns
- `:2472` `.wiki-topbar-inner-home` grid-template-columns
- `:2476` `.wiki-brand` gap
- `:2498-2501` `.wiki-search` justify-self, border-color, 5px radius (**dead class**)
- `:2507-2508` gold focus halo
- `:2517` `.locale-link::after` margin
- `:2541` `.wiki-sidebar` border-right-color
- `:2551` `.wiki-sidebar-heading` margin-bottom
- `:2566` `.wiki-sidebar-link` `border-left:2px solid transparent`
- `:2581` `[aria-current]` border-left-color `--wiki-accent`. This is a gold side stripe; remove it in PR2.
- `:2629` `.wiki-page-header`, `:2638` `.wiki-section-heading`, `:2643` `.wiki-panel`: border colours
- `:2773` `.wiki-status-table` th/td border colours
- `@media 1100px`: `:2779, :2783`
- `@media 900px`: `:2802`
- `@media 680px`: `:2828-2829` topbar grids and padding
- `:2857` `.wiki-topbar-inner` position
- `:2862, :2874, :2890-2891` `.wiki-search` (dead class)
- `:2925, :2931, :2939, :2942` `.wiki-search-control [data-slot=input|kbd]`
- `:3096-3097` `.wiki-article-panel .wiki-evidence`
- `:3109` 150ms transitions on `.wiki-data-row`, `.wiki-panel`, `[data-slot=card]`
- `:3238` kbd hidden at 680px

**C2. Delete `global.css:3243-3364`.** These are unlayered rules for dead Guild classes: guild-lifecycle-panel, -stats, -note, guild-membership-event(s), -dates and guild-member-progress. This includes the `@media 760px` block at `:3342-3364`.

**C3. Delete the 7 orphan components** from section 0, after the owner confirms. Three of them have uncommitted owner edits:
- `RecordCard.astro`
- `WikiPortalPanel.tsx`
- `WikiSourceCard.tsx`

Deleting them kills 14 more classes: status-dot, wiki-evidence*, wiki-index-*, wiki-source-*.

**C4. Dead selectors: 114 classes, every definition line listed in `dead-classes-final.tsv`.** When a rule's selector list mixes dead and live classes, remove only the dead selectors from the list. Examples: `wiki-reference.css:1333, 4498, 4867, 4239/4256`.

- **Guild (63):**
  - analytics-panel; calculation-meta; calculation-panel
  - coverage-grid; coverage-stat; coverage-stat-wide
  - daily-points; derived-note
  - difficulty-editor-heading; difficulty-icon (+ -normal, -primal, -wildscape); difficulty-inline; difficulty-policy; difficulty-setting-label; difficulty-settings; difficulty-settings-heading
  - entry-grid; export-actions; export-panel
  - goal-groups; goal-input; goal-label
  - history-date; history-delta; history-list; history-panel; history-range; history-row
  - import-content; import-controls; import-panel
  - lifecycle-content; lifecycle-note; lifecycle-panel; lifecycle-stats
  - member-actions; member-filters; member-progress; membership-event; membership-event-dates; membership-events
  - muted-line; period-columns; period-group; period-row
  - settings-content; settings-grid; settings-panel; settings-submit
  - source-zone-field
  - summary; summary-date; summary-grid; summary-heading
  - table-action; table-panel; text-button; total-cell; value-rules; visible-count; week-line
- **Wiki shell (40):**
  - wiki-brand-mark; -name; -subtitle
  - wiki-document-grid
  - wiki-featured-arrow; -link; -list; -mark
  - wiki-footer
  - wiki-home-brandline; -brandmark; -catalog-section; -dashboard; -featured-section; -index-grid; -page-header; -search; -server-copy; -status-panel; -status-rail
  - wiki-page-header-row; wiki-panel-header
  - wiki-portal-grid; -list
  - wiki-search; -icon; -shortcut
  - wiki-section-count; wiki-sidebar-bullet; wiki-status-mark
  - Plus the 14 that die with C3.
- **Map and tools (2):** map-source-note, tool-source-note.
- **Trade (5):** trade-glyph-item/-kks/-pokemon, trade-preview-glyph, trade-preview-pokemon. Also the `svg` descendant rules of `.trade-asset-*` at `trade.css:196-214`: the tiles render `<img>`.

**C5. Reconcile the 171 duplicates.** The split exists on purpose: `wiki-reference.css:3-4` says `global.css` owns layout and `wiki-reference.css` owns the skin.

1. The 67 dead duplicates go away in C4.
2. For the 104 live ones, delete the 784 `@layer components` declarations in `global.css:97-2436` that are overridden by an identical selector and property. Then merge the remaining layout and skin declarations into one rule per selector. Where properties conflict, the `wiki-reference.css` value wins, as it does today.
3. Merge in this order, running the harness after each area:

   | Area | Count | Classes |
   |---|---|---|
   | Shell | 43 | display-title, eyebrow, muted-copy, section-title, locale-link, status-label, wiki-article, -layout, -panel, wiki-brand, wiki-breadcrumb-separator, wiki-breadcrumbs, wiki-data-list, wiki-data-row (+ -meta, -name, -summary), wiki-empty-state, wiki-layout, wiki-main, -inner, wiki-mobile-nav, wiki-page-header, wiki-panel, wiki-search-control, wiki-section, -heading, wiki-shell, wiki-sidebar (+ -group, -heading, -icon, -link, -links, -note, -note-label), wiki-status-table, wiki-toc, -title, wiki-topbar (+ -actions, -inner, -inner-home) |
   | Tools | 9 | compare-record, tier-row-action, tool-description, tool-field, tool-section, tool-tab, tool-table, tool-table-wrap, tool-tabs |
   | Map | 17 | map-base-badge, map-boundary-note, map-category-button, map-control-button, map-coordinate-readout, map-details-panel, map-legend, map-legend-client-row, map-legend-heading, map-legend-row, map-legend-swatch, map-map-controls, map-marker, map-query, map-tool, map-viewport, map-viewport-shell |
   | Guild | 35 | account-content, -email, -grid, -hint, -panel, -toolbar; auth-form, -layout; create-form; derived-values; difficulty-editor, -editor-grid, -editor-total, -grid, -input, -setting; empty; field; file-button, -name; goal-group, -header, -row; message, -error; number; primary-button; ranking-tool; secondary-button; table, -heading, -wrap; tool-description, -heading; total |

   Guild goes last because `wiki-reference.css` holds three successive Guild generations that override each other: `:3203-4161`, `:4163-5418`, and the "final layout reset" at `:5420-5496`.
4. In the same pass, merge the same-file repeats listed in `selfdup-*.tsv` (123, 45 and 65).
5. **Move the merged CSS into layers in one deliberate step.** Today unlayered `wiki-reference.css` beats Tailwind utilities; after the move, utilities win. Watch the elements that mix wiki classes with utilities, for example `ContentSearch.tsx:111` (`wiki-data-row … hover:border-accent/60`).

**C6. Breakpoints and values stay frozen** throughout C1-C5. Remapping breakpoints and flipping token values happen in PR2.

**C7. `trade.css`: delete skin 1 declarations, `:1-701`, that skin 2 (`:703-1024`) overrides.** Run the same `shadow.cjs` method. The layout-only rules from skin 1 are kept. Also delete the dead rules at `:196-214` and `:439-490`.

**C8. Delete the fake controls:**
- `AppLayout.astro:140-155`: the dividers and the PanelLeft and Moon indicators.
- The chevron at `:138`, which suggests a dropdown on what is a plain link.
- Their CSS: `wiki-reference.css:251-278` and `:1668-1669`.

**C9. CI budget script: `scripts/design/check-tokens.mjs`.** It is plain Node with no dependencies, prototyped at `corte0/literal-budget.mjs`. It reads `scripts/design/budget.json`, which starts at `{total: 697, perFile: …}`. It fails if any file's count goes up, and `--ratchet` rewrites the budget downwards. It also checks the A7 rules plus:
- the `text-lg`/`text-2xl`/`shadow-*`/`bg-black` utility classes the reset removes
- `dark:` in `src/components/ui`
- `eyebrow` usage
- distinct font-size values (70 today) and distinct radii (31 today), each with a budget
- raw `\d+ms`/`cubic-bezier(` outside `tokens.css`

The commands:
```
pnpm design:check        # package.json: "design:check": "node scripts/design/check-tokens.mjs"
                         # "ci" (package.json:24): … pnpm lint && pnpm design:check && pnpm check …
node scripts/design/check-tokens.mjs --ratchet
```

The regex:
```
(?<![&\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(
```

A quick local check:
```
rg -P -c --glob '*.{css,astro,tsx,ts}' --glob '!src/styles/tokens.css' --glob '!src/styles/domain/palettes.css' --glob '!src/lib/design/tokens.ts' '(?<![&\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(' src
```

---

## D. Components

### D1. Changes to existing `ui/*`

**`button.tsx`**
- `:6`: drop `dark:`, add `motion-reduce:transition-none`, render `data-variant={variant}`.
- `:10`: default variant becomes `bg-primary text-primary-foreground hover:bg-link` (blue-ink on blue-hi still passes).
- `:12`: outline becomes `border-input bg-transparent hover:bg-raised hover:text-value` (3 `dark:` removed).
- `:16, :18`: drop `dark:`; destructive becomes `bg-danger/10 text-danger`.
- `:19`: link becomes `text-link`.
- **New `cta` variant:** `bg-gold text-gold-ink`, at most one per screen.
- **Sizes:**

  | Size | Line | Today | New |
  |---|---|---|---|
  | default | `:23` | `h-8` | `h-10 px-4 gap-2` |
  | xs | `:24` | | **delete** (unused) |
  | sm | `:25` | `h-7`, `text-[0.8rem]` | `h-9 px-3 text-sm pointer-coarse:h-10` |
  | lg | `:26` | `h-9` | `h-11 px-5 text-base` |
  | icon | `:27` | `size-8` | `size-10` |
  | icon-xs | `:28-29` | | **delete** |
  | icon-sm | `:30-31` | `size-7` | `size-9 pointer-coarse:size-10` |
  | icon-lg | `:32` | | **delete** |

- Call sites that change size: `WikiSearch.tsx:30` (icon-sm), `GuildRankingTool.tsx:1383` (icon) and `:1417` (sm). `ContentSearch.tsx:94` sets `min-h-10`, which becomes unnecessary.

**`input.tsx:11`:** `h-8` becomes `h-10`; `bg-background` becomes `bg-recess`; the placeholder becomes `text-hint`; drop `dark:`.

**`textarea.tsx:9`:** drop the 4 `dark:`; use `bg-recess`; replace `ring-3 ring-ring/50` with the same outline focus as Button.

**`tabs.tsx`**
- `:17`: `h-8` becomes `h-10`.
- `:51`: drop `shadow-sm`, the 2 `dark:` and the ring focus.
- `:52-53`: drop the 5 `dark:`; active tab uses `bg-raised text-value`.
- `:54`: `after:bg-foreground` becomes `after:bg-link`. The selection indicator is blue, not gold.

**`kbd.tsx:8`:** `text-[10px]` becomes `text-xs`; drop `dark:`.

**`badge.tsx:7, 14, 16`:** drop `dark:`.

**`dropdown-menu.tsx`**
- `:41` and `:138`: replace `shadow-md`/`shadow-lg` and `ring-foreground/10` with `border border-border shadow-e2`.
- Replace the tw-animate classes with `transition-[opacity,scale] duration-200 data-starting-style:opacity-0 data-starting-style:scale-98 data-ending-style:duration-140 data-ending-style:ease-in motion-reduce:transition-none`.
- `:90, :115, :164, :200`: items get `min-h-9 pointer-coarse:min-h-10`.
- `:90`: drop `dark:`.

**`dialog.tsx`**
- `:29`: `bg-black/10` plus `backdrop-blur-xs` becomes `bg-scrim` with no blur.
- `:29, :51`: same animation treatment as the dropdown.
- `:51`: `ring-1` becomes `border border-border shadow-e2`.
- `:60`: close button uses `size="icon"`.
- `:63, :96`: the English-only `Close` becomes a required `closeLabel` prop.

**`sheet.tsx`**
- `:31`: remove the blur; use `bg-scrim`.
- `:56`: `shadow-lg` becomes `shadow-e2`; `duration-200 ease-in-out` becomes `duration-260 ease-out data-ending-style:duration-[182ms] data-ending-style:ease-in motion-reduce:transition-none`.
- `:65`: close button uses `icon`.
- `:68`: `closeLabel`.

**`card.tsx` and `separator.tsx`:** keep them (tokens re-skin them), but no live page uses them.

### D2. New base-ui primitives for Corte 0

Add only `ui/tooltip.tsx` (`@base-ui/react/tooltip`) and `ui/field.tsx` (`@base-ui/react/field`). The gallery's form states need `Field` (`aria-describedby` and `aria-invalid`), and the compact game sizes need `Tooltip`.

- **Meter:** custom markup, not base-ui `Progress`. Progress animates `width`; the spec needs a compositor-only `scaleX`.
- **Section:** native `<details>`.
- **Skeleton:** CSS only.
- **Later cortes:** Popover and PreviewCard (Peek, Corte 4); Combobox, NumberField and RadioGroup (Corte 1).
- **Adding them:** `pnpm dlx shadcn add tooltip field` (base-nova style, `components.json`), then review the diff. The CLI may inject `:root` colour blocks into `global.css`; `check-tokens` catches that.

### D3. Game-layer components

These live in `src/components/game/*.tsx`. They are pure: no hooks, no client directive. Astro renders them as static HTML, and islands such as TradeDesk reuse them. Strings come from `src/i18n/ui.ts`. Game terms use the client's exact wording from a dictionary; the UI never translates them ad hoc (AGENTS localization rules).

**`UnitTooltip`**
```ts
{ size?: 'slot'|'mini'|'peek'|'card'|'detail'|'share';   // default 'card'
  title: string; headingLevel?: 2|3|4; subtitle?: {label:string; href?:string};
  sprite?: {src:string; alt:string; width:number; height:number};  // integer upscale → pixelated, else auto
  ball?: {id:string; name:string; src?:string} | null;
  rows: StatRowData[]; sections?: SectionProps[]; meter?: MeterProps;
  footer?: ReactNode; caption?: string;          // 'slot' shows no price inside the 64px box (critique #13)
  href?: string; vtKey?: string;                  // stretched-link title; data-vt-key
  state?: 'default'|'selected'|'pinned'|'unavailable'|'loading'; locale: Locale }
```

The sizes:

| Size | Layout |
|---|---|
| `slot` | 64px box with the ball badge. The accessible name holds the title and the key stats. |
| `mini` | One row: 32px sprite, title and 2 stats. |
| `peek` | 18rem wide. Sections collapsed. |
| `card` | 15-17.5rem wide, up to 5 rows plus a footer. |
| `detail` | Up to 28rem, scaled 1.25× through `--cx-unit-scale`. Sections open. |
| `share` | 360px wide, no links. |

The markup is `<article aria-labelledby>`, a `dl.cx-stats`, then `<footer>`. The e0 border is always drawn, because card against surface is only 1.09:1. States:
- `selected` and `pinned`: a 2px `--cx-blue-hi` outline, an icon, and visible text ("Seleccionado" / "Fijado").
- `unavailable`: a banner text and a grayscale sprite only. Text opacity is never lowered.
- `loading`: a static skeleton in tooltip shape.
- Focus: `:has(a:focus-visible)` draws the ring on the whole article.

**`StatRow`**
```ts
{ label: string; value?: ReactNode; state?: 'known'|'unknown'; unit?: string; match?: boolean }
```
- The label is a `dt` in `--cx-gold`, Poppins 600, 13px, Title Case, and the component appends the colon.
- The value is a `dd` in `--cx-value`, Inter 500, 13/21px, tabular, right-aligned.
- `unknown` shows "No informado" / "Not stated" in `--cx-muted` and is never 0.
- `match` draws a 1px blue-hi outline, a check icon and hidden "coincide" text. There is no side stripe.

**`Meter`**
```ts
{ variant: 'compact'|'training'; value: number|null; label: string; level?: number; locked?: boolean; index?: number }
```
- `compact`: a 4px gold bar on `--cx-bar-track` with 0 radius. The value text is `copy-2`, 12px.
- `training`: a 12px bar with a 1px `line-strong` border, `train-track` track and `train` fill. The **% is printed outside the bar** (white on green is 2.78:1). `locked` shows an icon plus the text "Bloqueado".
- `role="progressbar"` with `aria-valuenow/min/max`, and `aria-valuetext="53% · Lv. 16"`.
- `null` renders an empty bar plus "No informado". Values are clamped to 0-100.
- The fill is `transform:scaleX(var(--p))` with `@starting-style` from 0, duration `--cx-d4`, and a delay of `min(index,7)*30ms`. Reduced motion turns the transition off.
- In forced-colours mode the fill uses `forced-color-adjust:none` and `Highlight`.

**`Section`**
```ts
{ title: string; count?: number; defaultOpen?: boolean; name?: string /* exclusive <details name> */; children }
```
- A `<details class="cx-section">` whose summary grid centres "Title: N".
- The chevron is lucide `ChevronDown` at `strokeWidth` 1.5. It points down when open and rotates -90° when closed, over `--cx-d3`.
- The summary is at least 40px tall.
- `interpolate-size:allow-keywords` plus `::details-content` animate the height where supported.

**`SpriteSlot`**
```ts
{ size?: 28|36|48|64; state: 'filled'|'empty'|'locked'|'unknown'; item?: {name:string; src?:string; href?:string; tier?:string}; locale }
```
- The bevel is `@supports (corner-shape:bevel)` with a `--cx-r-slot` 4px fallback.
- `empty` is a dashed `line-strong` border plus hidden text "Vacío".
- `locked` is a lock icon plus the text "No comprado".
- `unknown` is "?" plus "No informado".
- The name is the accessible name. In `card`/`detail` it is also shown as text; in compact sizes it is a Tooltip on focusable slots.

**`MoneyChip`**
```ts
{ amount: bigint|string; unit: 'kk'|'gold'|'diamonds'|'brl'|'usd'|'mxn'; locale }
```
- The exact grouped integer is always shown, using `en-US` grouping in both locales (the Trade convention; `smoke.spec.ts:129`).
- The compact form ("10kk", "250k") appears only when it is exact, reusing `compactKks` in `lib/trade/draft.ts`.
- The unit is always written out.
- The chip is neutral: raised background with a `line-strong` border. It is **never gold-toned** (critique #9).

**`BallChip`**
```ts
{ ball: {id; name; src?} | null; showName?: boolean }
```
- An 18px box, because Net Ball is 17×16 (critique #32).
- `pixelated` only at integer scale.
- The name is always available.

### D4. Shell components (`src/components/shell/`)

- **`PageHeader.astro`:** `{ title, actions?, breadcrumbs? }`. The h1 uses `font-game` 600 `text-display`. It **has no eyebrow, tagline or intro props**, so the owner's anti-slop rule is built into the API. It replaces the eyebrow + `display-title` + `muted-copy` block on 12 pages (D5).
- **`Panel.astro`:** `{ as, title?, pad }`, an e0 surface with a 12px radius.
- **`Breadcrumbs.astro`:** `{ items, locale }`, with a localized `aria-label`.
- **`LocaleSwitch.astro`:** the link keeps the path and query, using `lib/i18n/alternate-path.ts`. That helper also emits page-level `hreflang` (plus `x-default`) and fixes `AppLayout.astro:97-98, 130-139`.
- **`Notice.astro`:** `{ tone: 'info'|'warning'|'danger'|'success', children }`, icon plus text.
- **`Field.tsx`:** wraps `ui/field`; label, error and `aria-describedby`.
- **`NavigationTransitions.astro`:** see F.
- **Table CSS:** `.cx-table`, with a sticky head, tabular numbers, and 40px rows on coarse pointers.

### D5. Content cleanup that deleting `.eyebrow` forces

Delete these kickers or intros:

| File | Lines |
|---|---|
| `buscar/index.astro` | 63, 65 |
| `cambios/index.astro` | 41, 43, 47 |
| `guias/index.astro` | 71 |
| `herramientas/guild.astro` | 48, 50 |
| `herramientas/index.astro` | 86, 88 |
| `herramientas/pokemon.astro` | 48, 50 |
| `index.astro` | 96 |
| `mapa/aportar.astro` | 119, 121 |
| `mapa/index.astro` | 52, 54 |
| `pokedex/index.astro` | 73, 75 |
| `pokedex/[slug].astro` | 145 |
| `rotaciones/index.astro` | 56, 58 |
| `sistemas/index.astro` | 65, 67 |
| `GuildWorkspaceChrome.tsx` | 32 |
| `GuildPersistencePanel.tsx` | 313 |
| `PokemonExplorer.tsx` | 249, 334 |

Other changes:
- **Convert to real labels (`StatRow`/`dt`):** `sistemas:106, 112, 118` and `rotaciones:71, 76, 82`.
- **Remove developer fallbacks:** `rotaciones:66` (`'assertion'`) and `sistemas:80, 100` (`'item'`/`'move'`).
- **Review with the owner:** `[slug].astro:190` (variant label), `PokemonExplorer.tsx:296`, `ContentSearch.tsx:116` and `aportar.astro:182` (make it an h2).

---

## E. Fonts

**The recommendation is Astro 7's stable `fonts` config** (top-level, `@version 6.0.0`, `node_modules/astro/dist/types/public/config.d.ts:2885`) **with `fontProviders.local()` pointing into pinned Fontsource packages.** Add the devDependencies `@fontsource/poppins` and `@fontsource-variable/inter`.

Why this and not the alternatives:
- **It is offline and deterministic.**
  - `local.js` resolves package specifiers through `createRequire(root).resolve`, and falls back to `new URL(spec, root)`.
  - `fontProviders.fontsource()` fetches `api.fontsource.org` and jsDelivr at build time with `@latest` (unifont `index.mjs:481`).
  - `fontProviders.npm()` reads the local CSS but rewrites the URLs to jsDelivr (`index.mjs:~760`).
- **Plain `@fontsource` CSS imports would be simpler** but give no preload links and no metric-matched fallbacks.

`astro.config.mjs`:
```js
import { defineConfig, fontProviders } from 'astro/config';
const LATIN = ['U+0000-00FF','U+0131','U+0152-0153','U+02BB-02BC','U+02C6','U+02DA','U+02DC','U+0304','U+0308','U+0329','U+2000-206F','U+20AC','U+2122','U+2191','U+2193','U+2212','U+2215','U+FEFF','U+FFFD'];
const LATIN_EXT = ['U+0100-02BA','U+02BD-02C5','U+02C7-02CC','U+02CE-02D7','U+02DD-02FF','U+0304','U+0308','U+0329','U+1D00-1DBF','U+1E00-1E9F','U+1EF2-1EFF','U+2020','U+20A0-20AB','U+20AD-20C0','U+2113','U+2C60-2C7F','U+A720-A7FF'];
export default defineConfig({ output:'server', adapter:vercel(), integrations:[react()], vite:{plugins:[tailwindcss()]},
  fonts: [
    { provider: fontProviders.local(), name: 'Inter Variable', cssVariable: '--font-inter', fallbacks: ['system-ui'],
      options: { variants: [   // order matters: [0] is preloaded
        { src:['@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'], weight:'100 900', style:'normal', unicodeRange:LATIN },
        { src:['@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2'], weight:'100 900', style:'normal', unicodeRange:LATIN_EXT } ] } },
    { provider: fontProviders.local(), name: 'Poppins', cssVariable: '--font-poppins', fallbacks: ['system-ui'],
      options: { variants: [
        { src:['@fontsource/poppins/files/poppins-latin-600-normal.woff2'], weight:600, style:'normal', unicodeRange:LATIN },
        { src:['@fontsource/poppins/files/poppins-latin-700-normal.woff2'], weight:700, style:'normal', unicodeRange:LATIN },
        { src:['@fontsource/poppins/files/poppins-latin-ext-600-normal.woff2'], weight:600, style:'normal', unicodeRange:LATIN_EXT },
        { src:['@fontsource/poppins/files/poppins-latin-ext-700-normal.woff2'], weight:700, style:'normal', unicodeRange:LATIN_EXT } ] } } ],
});
```

Notes on the config:
- **Unicode ranges:** copy the two lists verbatim from each package's `index.css` after install. A unit test asserts they match.
- **If a package's `exports` field blocks `require.resolve`,** use `./node_modules/@fontsource/...` instead.
- **Build output:** Astro writes hashed files to `/_astro/fonts/`, emits `@font-face` with `font-display:swap`, and sets `:root{--font-inter:"Inter Variable-<hash>", <fallbacks>, system-ui}`.
- **No request goes to Google at runtime.** A test asserts this.

**Head, in `AppLayout.astro`:**
```astro
import { Font, fontData } from 'astro:assets';
<Font cssVariable="--font-inter" /><Font cssVariable="--font-poppins" />
<link rel="preload" href={fontData['--font-inter'][0].src[0].url} as="font" type="font/woff2" crossorigin />
<link rel="preload" href={fontData['--font-poppins'][0].src[0].url} as="font" type="font/woff2" crossorigin />
```

Why the preloads are hand-written:
- The local provider sets no `meta.subset` (`collect-font-assets-from-faces.js`).
- Because of that, `<Font preload={[{subset:'latin'}]}>` matches nothing, and `preload` (or a weight filter) preloads latin-ext too.
- `fontData` keeps the variant order, so `[0]` is the latin file each time.

**What gets preloaded:** Inter latin (one variable file covers every weight) and Poppins latin 600 (page titles and labels). Poppins 700 and both latin-ext files are not preloaded.

**Fallback metrics against layout shift:**
- `fallbacks:['system-ui']` makes `optimize-fallbacks.js` generate metric-adjusted `@font-face` rules (size-adjust plus ascent, descent and line-gap overrides). They cover BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue and Arial (`system-fallbacks-provider.js:80-83`), so Windows, Android and Mac are all handled.
- Every text token has a unitless or explicit line-height.
- Poppins is used only at 600/700, so no weight is synthesized.
- The target is **CLS < 0.05** on `/es/`, `/es/pokedex/` and `/es/pokedex/chimchar/`. The Pokédex card `<img>` has no width or height (`PokedexGrid.tsx:309-316`), so its CSS box must reserve the space.

**Other changes:**
- `guild-ranking-image.ts`:
  - The colours at `:61-71` come from `lib/design/tokens.ts`.
  - The canvas fonts at `:126-301` read `getComputedStyle(document.documentElement).getPropertyValue('--font-inter')`, because the family name includes a hash, and call `await document.fonts.load(...)` before drawing.
  - The 10-11px text at `:189, :201, :238` moves up to at least 12px.
- Set `--font-body`/`--font-display` (`global.css:32-33`) to Inter/Poppins in PR2 and delete them in PR7. They cover 12 `font-family` declarations.

---

## F. View-transition infrastructure

Native cross-document view transitions are already on: `wiki-reference.css:1735-1742`, and there is no `ClientRouter`. That stays.

### `motion.css` (unlayered)

```css
@view-transition { navigation: auto; }
@media (prefers-reduced-motion: reduce) { @view-transition { navigation: none; } }
::view-transition-group(*) { animation-duration: var(--cx-d3); animation-timing-function: var(--cx-ease-out); }
::view-transition-group(vt-art), ::view-transition-group(vt-title), ::view-transition-group(vt-price) { animation-duration: var(--cx-d5); }
::view-transition-old(vt-art), ::view-transition-new(vt-art) { animation: none; image-rendering: pixelated; }
html:active-view-transition-type(forward)::view-transition-old(root) { animation: cx-fade-out calc(var(--cx-d4)*var(--cx-exit)) var(--cx-ease-in) both; }
html:active-view-transition-type(forward)::view-transition-new(root) { animation: cx-enter var(--cx-d4) var(--cx-ease-out) both; }
/* type 'back' keeps the default cross-fade at d3 */
.wiki-topbar { view-transition-name: shell-top; } .wiki-sidebar { view-transition-name: shell-nav; }
::view-transition-group(shell-top), ::view-transition-group(shell-nav),
::view-transition-old(shell-top), ::view-transition-new(shell-top), ::view-transition-old(shell-nav), ::view-transition-new(shell-nav) { animation: none; }
@keyframes cx-enter { from { opacity: 0; translate: 12px 0; } }
@keyframes cx-fade-out { to { opacity: 0; } }
```

Delete `wiki-reference.css:1735-1742` and `:3133-3136`. Protect smooth scrolling in `base.css` (see G6).

### Helper: `src/components/shell/NavigationTransitions.astro`

It is included in `<head>` of `AppLayout.astro` and contains:
- `<link rel="expect" href="#main-content" blocking="render">`
- a `<script is:inline>` of about 60 lines of plain JavaScript

It must be inline, because Astro-bundled scripts are deferred modules and `pagereveal` fires before they run.

**Markup contract:**
- A list card is `<a data-vt-key="/es/pokedex/chimchar/">`, with its parts marked `data-vt-part="art|title|price"`.
- The detail root is `[data-vt-self]`, and uses the same `data-vt-part` children.
- The script assigns `vt-<part>` names inline, only to one card per navigation, and clears them on `viewTransition.finished`.

**`pageswap`:**
- If there is no `e.viewTransition`, return.
- Work out the direction from `e.activation.navigationType`: `traverse` compares `entry.index` with `from.index` to get `forward` or `back`; `push` and `replace` are `forward`.
- Add it with `e.viewTransition.types.add(dir)`.
- The destination is `norm(e.activation?.entry.url)`, or `sessionStorage['cx:vt:click']` when there is no activation (Safari).
- If `[data-vt-key="${CSS.escape(dest)}"]` exists: name its parts and store `{key: dest, dir}`.
- Otherwise, if `[data-vt-self]` exists and `dest === sessionStorage['cx:vt:origin']`: name the self parts and store `{key: here, dir: 'back'}`.

**`pagereveal`:**
- Read and clear the stored pair.
- Skip when the navigation is a `reload`.
- On a detail page: name the self parts only if `pair.key === here`. Store `cx:vt:origin` from `navigation.activation?.from?.url`, or from a same-origin `document.referrer`.
- On a list page: name the card whose key equals `pair.key`.
- Call `e.viewTransition.finished.finally(clear)`.

**A capture-phase click listener** records `cx:vt:click` for fallback navigation. It ignores `button≠0`, modifier keys and `target=_blank`.

**Reduced motion:** CSS sets `navigation:none`, so `e.viewTransition` is null and the helper does nothing.

**Snappier morphs (optional):** Astro `prefetch: { defaultStrategy: 'hover' }`. Morphs wait for the page to load, and Chrome gives up after 4 s.

### Pokédex fix

- Delete the per-card `transitionName` and inline style at `PokedexGrid.tsx:291` and `:315`.
- On the `<a class="pokemon-card">` at `:294-301`, add `data-vt-key={entry.href}` (normalized pathname). Give the `<img>` `data-vt-part="art"`.
- In `pokedex/[slug].astro`, delete `:102` and `:139`. Add `data-vt-self` to the `<article class="pokemon-profile">`, `data-vt-part="art"` to the `<img>`, and optionally `data-vt-part="title"` on the h1 at `:146` and the card h2 at `:326`.
- Fix the Spanish-only `alt` at `:137`.
- Back-morphs work because `PokedexGrid` is `client:load` with SSR markup (`pokedex/index.astro:87`), so the first 48 cards exist at `pagereveal`.

Per critique #20, targets that are auth-gated islands must use same-document `startViewTransition` in later cortes.

---

## G. Tests

### G1. Changes to `tests/e2e/smoke.spec.ts`

| Lines | Change |
|---|---|
| `:173` | `toContain('Verdana')` becomes a match on `/Inter Variable/`. Add: h1 `fontFamily` matches `/Poppins/`; `await document.fonts.ready` and `document.fonts.check(...)` are true. |
| `:175-178` | The absolute `x=491`, `w=1536` become checks derived from tokens: sidebar = 208, main width ≤ `--cx-shell-max`, main centered. |
| `:180-200` | Replace the `.codex-home-*` e0 contract with the same check on `.cx-panel`, `.cx-unit` and `[data-slot=card]`: 1px border, `box-shadow: none` at rest. The home selectors will change. |
| `:224-227` | Add viewports 768×1024 and 1280×800 (breakpoint consolidation). |
| `:205-220` | Add the gallery route. |
| `:426` | `'Close'` becomes `'Cerrar'` (the `closeLabel` fix). |

Unchanged in Corte 0, but they will break with the owner's anti-slop pass, so flag them:
- `:16` and `:161`: the home h1 is a tagline.
- `:79`: "Outfit del juego · #509" shows an internal ID.
- `:101`: "Premier · prueba" is a test label shown to users.
- `:146`: "Precio NPC: aún no verificado…" is a data-pipeline note.
- `:498`: the raw enum `pending_review` is shown to users.

`:162` (`/es/`) stays. Add a path-preserving check: on `/en/pokedex/chimchar/`, the switch goes to `/es/pokedex/chimchar/`.

### G2. `tests/e2e/a11y.spec.ts`

- Add the devDependency `@axe-core/playwright`.
- For every route (es and en) plus the gallery, run `new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()`. Fail on `serious` or `critical`.
- Repeat with the dialog, sheet and dropdown open, and with every `<details>` expanded.

### G3. `tests/design/tokens.test.ts` (Vitest)

- Parse `tokens.css` and assert the contrast table (`corte0/contrast.mjs`). Pairs that must pass:
  - copy/canvas 16.33
  - value/card 15.68
  - gold/card 9.58
  - blue-hi/canvas 9.38, blue-hi/card 7.96
  - muted/card 4.98
  - line-strong/card 3.03
  - gold-ink/gold 11.02
  - blue-ink/blue 6.65
  - train/train-track 5.02
  - gold/bar-track 6.84
- Pairs that must stay forbidden:
  - muted on raised: 4.48
  - white on blue: 2.61
  - line-strong on raised: 2.73. Controls never sit on raised surfaces.
  - white on train: 2.78
- `lib/design/tokens.ts` matches `tokens.css`.
- The font unicode ranges match the package CSS.
- Change `vitest.config.ts:12` to include `tests/**/*.test.{ts,tsx}`, and render components with `react-dom/server` to assert their ARIA.
- `tests/i18n/alternate-path.test.ts` covers the locale path helper.

### G4. `tests/e2e/design-contract.spec.ts`

- No request to `fonts.googleapis.com`, `fonts.gstatic.com` or `cdn.jsdelivr.net`.
- At most one `[data-variant=cta]` per route.
- Every visible `a, button, input, select, summary, [role=button]` is at least 40px tall in a `Pixel 7` project with `hasTouch`. Inline prose links are exempt (WCAG 2.5.8).
- Computed styles of a `ui` outline Button are identical under `colorScheme: 'light'` and `'dark'`.
- CLS < 0.05, measured with a buffered `PerformanceObserver('layout-shift')`.

### G5. Visual snapshots (`tests/e2e/gallery.visual.spec.ts`, tag `@visual`)

- One `toHaveScreenshot` per `[data-gallery-section]` at 1280 and 390, with `reducedMotion: 'reduce'`, `animations: 'disabled'` and `caret: 'hide'`, after `document.fonts.ready`.
- Generate baselines only in the Linux container `mcr.microsoft.com/playwright:v1.63.0-noble`, as a new job in `.github/workflows/ci.yml`.
- In `playwright.config.ts`: set `snapshotPathTemplate`, `expect.toHaveScreenshot` defaults, and projects for desktop, mobile-touch and reduced-motion.
- **Gallery route:** `src/pages/[locale]/galeria/index.astro`.
  - `noindex,nofollow` through a new `AppLayout` `noindex` prop plus a head slot. It is not in the nav.
  - A visible "Datos de ejemplo" notice.
  - Fixtures in `src/fixtures/synthetic/gallery.ts`, labelled `SYNTHETIC` (critique #40).
  - It shows every state of every D3 and D4 component, plus the `ui/*` components.

### G6. `tests/e2e/motion.spec.ts`

With `reducedMotion: 'reduce'`:
- `html` `scroll-behavior` is `auto`. `base.css` wraps `smooth` in `@media (prefers-reduced-motion: no-preference)`; it is unprotected today at `global.css:69`.
- The dialog content's transition duration is 0.
- The meter fill has no transition.
- An init script records `pageswap`/`pagereveal`, and `e.viewTransition` is null.

With `no-preference`:
- Grid to Chimchar: exactly **one** element has a non-`none` `view-transition-name` when `pageswap` fires, and the detail page names `vt-art`.
- Browser back names the Chimchar card.

---

## H. Docs to rewrite

`DESIGN.md`, `PRODUCT.md` and `.impeccable/` are untracked today, so they have to be added to git.

### `DESIGN.md`

**Front matter:**
- The `cx-*` colours with their roles.
- Typography: `game-title` (Poppins 700 16), `game-label` (Poppins 600 13, Title Case, colon), `display` (Poppins 600, clamp 28-40), `body` (Inter 400 14/16), `stat-value` (Inter 500 13, tabular), `meta` (Inter 12, the floor), `code` (mono, IDs and coordinates only).
- `rounded`: bar 0, slot bevel/4, control 6, card 8, panel 12.
- Spacing: 4px base.
- Elevation: e0, e1, e2.
- Motion: d1-d5, ease-out/ease-in, exit at 0.7×.
- Component entries: button-primary (blue), button-cta (gold, one per screen), input, panel, unit-tooltip, stat-row, meter-compact, meter-training, section, sprite-slot, money-chip, ball-chip.

**Body rules:**
- **Two Voices:** game layer and shell.
- **Gold Budget:** gold is for game labels, the compact meter and at most one CTA. It is never a link, a state or a selection.
- **Blue Selection:** selection, pin and match use a `blue-hi` ring plus an icon plus text.
- **Numbers:** Inter tabular.
- **12px Floor.**
- **Elevation:** replaces Border Before Shadow.
- **Dark Only.**
- **Motion:** tokens only, no bounce, an equivalent reduced-motion experience, and only the activated card gets a transition name.
- **40px Touch.**
- **No-Slop Content,** with the owner's list verbatim: kickers and eyebrows, taglines, intros that restate the title, process/status meta text, developer text, redundant disclaimers, duplicated labels, filler empty states, badges that add nothing, fake controls.
- **Kept:** Domain Color and Meaningful Color.
- **Removed:** One Family, the Verdana/Cascadia contract, `focus-indigo`, `action-blue #93c5fd`, `alliance-gold #e8a238`, "identity-only gold".

### `.impeccable/design.json`

Regenerate it:
- `colorMeta`: canvas, blue and gold, with measured provenance (SS1/SS2 and the official-candidate wiki).
- `typographyMeta`: the seven styles above.
- `shadows`: e1, e2.
- `motion`: d1-d5 and both easings. This replaces the unused 120/220ms curves at `:61-68`.
- `breakpoints`: 640/768/1024/1280.
- `components`: Primary (blue), CTA (gold), Search Field (recess, `line-strong`, `blue-hi` focus), UnitTooltip card, StatRow, Meter compact and training, Section, Navigation Item.
- `narrative`: delete the Quiet Accent Rule (`:130`) and One Family; add the new rules.

### `docs/DESIGN_DIRECTION.md`

- Retitle it "Dirección de diseño — Codex Tooltip".
- **Decision:** the owner, on 2026-09-18, adopted Codex Tooltip, superseding the RubinOT/Verdana contract of 2026-09-11. The game layer rolls out gradually, with Corte 0 before any Comercio work.
- **Evidence:** the measured colours and fonts.
- **Contract:** tokens with contrast values, shell geometry (64/208/1536, unchanged unless the tokens change), surfaces e0-e2, radii, motion and view transitions.
- **Content rules:** the owner's anti-slop list.
- **Rollout order:** section I.
- **New acceptance gate:** axe, the contrast table, the literal-budget ratchet, gallery snapshots, CLS < 0.05, reduced motion, 40px targets, `pnpm ci` plus Playwright, then the owner's visual review.
- **Carry over** the Preserve list (`:118-120`).
- **Map the critique fixes to decisions:**

  | Critique item | Decision |
  |---|---|
  | 9 | Gold budget; neutral KK chip |
  | 10 | Shift pins only on a lone Shift keyup during pointer hover; keyboard uses the Pin button |
  | 13 | No price inside the slot |
  | 15 | No provenance glyphs |
  | 20 | Morphs only when both pages are SSR/prerendered |
  | 32 | 18px ball box; 12px floor |
  | 40 | Labelled fixtures; noindex gallery |

**Also add:**
- An entry in `docs/DECISION_LOG.md` for the design-gate reopening (AGENTS.md:98).
- An update to `docs/CURRENT_STATUS.md`.
- A roadmap note mapping Corte 0 to Phase 3A (critique #18).

---

## I. Ordering and risks

### I1. The PR sequence

| PR | Content | Proof |
|---|---|---|
| 0 | Style-freeze harness, `check-tokens.mjs` in report mode, axe spec in report mode. Docs land as the target contract with status "aprobado, en implementación". | Baselines captured. |
| 1 | Cascade surgery with **values frozen**: C1-C5, C7, C8 (plus C3 once the owner confirms). The CSS split and layers from A. `--wiki-*` stays as aliases **with their current values** in `tokens.css`. | Harness diff = 0 (except C8), and the smoke suite passes unchanged. |
| 2 | The re-skin: flip the aliases to `cx-*` and collapse them, fonts, the dark variant, `theme.css` resets, `ui/*` changes (D1), `base.css`, breakpoint remap, remove the legacy gold stripes and halos. | Update `smoke:173, :175-178, :426`. Screenshot review by the owner. |
| 3 | `motion.css`, the view-transition helper, the Pokédex fix, the reduced-motion suite. | |
| 4 | Game-layer and shell components, gallery, visual baselines, axe on the gallery. | |
| 5 | Shell chrome and content: the locale path, D5 eyebrow/intro removal, `PageHeader` on 12 pages. | Update the flagged smoke tests. |
| 6 | Per-surface migrations: Guild, map, Pokédex, home, guides, then Trade (skin 1 already gone). Each PR lowers the literal budget. | |
| 7 | Codemod `var(--wiki-*)` to `var(--cx-*)`, then delete the aliases. | Budget ≤ about 40 (palettes only). |

**Why this order:** the structural change and the visual change never land together. The harness can only prove "no change" while the values are frozen.

### I2. Risks and mitigations

1. **Moving unlayered `wiki-reference.css` into layers makes utilities win.** Elements that mix a wiki class with utilities change. The harness catches this in PR1.
2. **`--color-*`, `--text-*` and `--shadow-*` resets drop utilities silently.** `check-tokens` greps for the removed utility names.
3. **The shadcn CLI may inject colour literals** into `global.css`. The budget catches it.
4. **pnpm strict `exports` could block the font paths.** Use the `./node_modules/...` fallback. The build must never touch the network, so test with `--offline`.
5. **Poppins has no tabular digits** and is wide (0.87em). Numbers never go in Poppins, and es labels need their own width review.
6. **The PNG export** needs the hashed family name and font loading (E).
7. **`corner-shape`, `interpolate-size`/`::details-content` and view-transition types are Chromium- or Safari-only.** Each is a progressive enhancement; Firefox navigates instantly.
8. **Stale `sessionStorage` keys** under bfcache: cleared on `pagereveal` and `finished`.
9. **Visual snapshots differ across OSes.** Generate baselines on Linux only.
10. **`--wiki-line-strong` jumps** from #373a41 to #646d7c. Each of its 23 uses needs a decorative-vs-control decision in PR2, otherwise the page gets noisy.
11. **The owner's uncommitted edits** to the orphan components and CSS must be committed and settled before PR1.