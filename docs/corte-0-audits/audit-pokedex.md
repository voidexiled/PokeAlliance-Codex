# Corte 0 audit: Pokédex and Pokémon tools

Repo root: `C:/Users/jalom/Documents/ChatGPT/PokeAlliance-Codex`. I changed no repo files. The one scratch file is the contrast calculator at `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/corte0/contrast-dex.mjs`.

**Path aliases used below**

| Alias | Path |
|---|---|
| IDX | `src/pages/[locale]/pokedex/index.astro` |
| DET | `src/pages/[locale]/pokedex/[slug].astro` |
| GRID | `src/components/wiki/PokedexGrid.tsx` |
| OUT | `src/components/wiki/OutfitPreview.tsx` |
| PM | `src/lib/content/pokemon-media.ts` |
| OM | `src/lib/content/outfit-media.ts` |
| WR | `src/styles/wiki-reference.css` |
| GL | `src/styles/global.css` (only the rules that style PokemonExplorer) |
| TPK | `src/pages/[locale]/herramientas/pokemon.astro` |
| EXP | `src/components/tools/PokemonExplorer.tsx` |
| ROS | `src/lib/tools/pokemon-roster.ts` |
| SMOKE | `tests/e2e/smoke.spec.ts` |

**What I checked against real data and build output**

- **Fact keys.** `data/normalized/pokemon-roster.json` has 910 records. They contain only 8 fact keys: generation, level, variant, elements, image, detailAvailable, and tier and function (818 records each). All 8 are in DET's exclusion list (`:51-63`).
- **Tier labels.** 80 records have text tiers: Super Rare, Legendary, ULTIMATE, Mythic and Ultra Rare. The built grid page contains 12× "TLegendary", 24× "TSuper Rare", 27× "TULTIMATE", 3× "TMythic" and 14× "TUltra Rare". `dist/client/es/pokedex/shiny-alakazam/index.html` shows "TLegendary" and "6 campos".
- **Variant pages.** `dist/client/es/pokedex/smeargle/index.html` has variant links all labelled "Normal". Pokédex #235 has 20 variants and #201 has 3.
- **View-transition names.** `dist/client/es/pokedex/index.html` has 48 inline `view-transition-name: pokemon-art-*` declarations. It weighs 514 KB, because 910 entries are passed as island props.
- **Image alt.** `dist/client/en/pokedex/bulbasaur/index.html` has `alt="Bulbasaur, sprite de PokeAlliance"` on the English page.
- **Outfits.** `public/images/outfits/manifest.json` has only 5 outfits: bulbasaur, charmander, charizard, shiny-charizard and squirtle.

---

## 1. Inventory

| Route / module | Purpose |
|---|---|
| `/{es,en}/pokedex/`, IDX:1-90 | Catalog page. Builds 910 `PokedexEntry` props (IDX:34-53) from the normalized roster. Shows a red "device" masthead (IDX:67-84) above the `PokedexGrid` island (`client:load`, IDX:87). |
| `/{es,en}/pokedex/{slug}/`, DET:1-238 | 1,820 prerendered detail pages. Contains a hero (art, number, h1, type chips, a 2×2 stat grid, a variant picker; DET:123-174), the OutfitPreview island (DET:176-185), a "Datos de la ficha" section (DET:187-207) and prev/next/back navigation (DET:209-235). |
| GRID:1-370 | Client island with: search plus the `/` shortcut (:101-116, :178-196); a variant segmented switch (:198-217); generation, type and sort selects (:219-271); a results bar (:274-284); a 48-per-page grid of link cards, each giving its sprite a view-transition name (:286-345); an empty state (:347-353); and Load more (:356-367). |
| OUT:1-322 | `client:visible` island. Shows the in-game idle outfit in 4 directions, with a WebGL outline "aura" (Alliance, or an unverified Premier; comment at :18-19). Only the 5 mapped species have one. |
| PM:1-7 | Rewrites relative sprite paths to `https://wiki.pokealliance.com`, which means every Pokémon image is hotlinked at runtime. |
| OM:1-32 | Joins `data/pokemon-outfits.json` with `public/images/outfits/manifest.json`. `outfitFrameUrl` builds the `/images/outfits/{slug}/{dir}-idle.png` path. |
| WR Pokédex CSS | Rules by line range:<br>• `:1734-1742` site-wide `@view-transition`, placed inside the Pokédex block<br>• `:1744-1754` `--dex-*` and default type tokens<br>• `:1756-2384` catalog<br>• `:2386-2458` the 18 type palettes<br>• `:2460-2968` detail page and outfit preview<br>• `:2970-3131` responsive rules<br>• `:3133-3151` reduced motion |
| `/{es,en}/herramientas/pokemon/`, TPK:1-55 | "Comparar Pokémon" page: breadcrumb, header with eyebrow and intro, and the `PokemonExplorer` island. |
| EXP:1-416 | Two tabs:<br>• **Comparar:** filter input, two selects, two record cards and an 8-row table.<br>• **Explorar tiers:** search, tier/role/variant selects and a 910-row list with a "Usar en comparar" button per row.<br>It reads `data/staging/pka-admin-wiki.pokemon-roster.json` through ROS, which is **not the dataset the Pokédex uses**. |
| GL:1134-1374, :2330-2342, :2373-2398 | Explorer styles in `@layer components`. They are partly overridden by unlayered WR:1338-1350, :1459-1479, :1481-1509 and :1531-1566. |

---

## 2. Content slop

Where no locale is named, the row applies to both. Proposed Spanish labels use sentence case, which is Spanish orthography. English labels use Title Case with a trailing colon, as the tooltip grammar requires.

### Pokédex index

| file:line | Current text | Problem | Action |
|---|---|---|---|
| IDX:18,26,74 | "Pokédex" (h1 and `<title>` via AppLayout.astro:99) | none | **KEEP**: this is the page name. |
| IDX:19,27 | "Índice de especies y variantes de PokeAlliance." / "PokeAlliance species and variant index." | Vague meta description. | **REPLACE**:<br>es: "Busca los Pokémon de PokeAlliance por nombre, número, tipo, generación o variante shiny."<br>en: "Search PokeAlliance Pokémon by name, number, type, generation or shiny variant." |
| IDX:20,28,73 | "Archivo de campo" / "Field archive" | Decorative kicker. | **DELETE**, along with WR:1839-1841. |
| IDX:21,29,75 | "Encuentra una especie, reconoce su variante y abre su ficha." / "Find a species…" | Intro that restates the obvious. | **DELETE**, along with WR:1852-1857. |
| IDX:22-23,30-31,77-81 | "Registro PokeAlliance · 910 · entradas" / "PokeAlliance roster … entries" | A decorative stat that repeats the live count (GRID:277). On screens under 768px the labels are hidden (WR:2996-3001), leaving a bare "910". | **DELETE** the block and WR:1859-1880 and :3014-3020. |
| IDX:59-66 | Breadcrumb "Inicio / Pokédex" | On a first-level page it repeats the h1 and the active sidebar item. | **DELETE** on first-level pages. This is a site-wide decision; keep it on DET and TPK. |
| IDX:86 | `aria-label="Pokédex"` on `<section>` | Repeats the h1 and creates a redundant region landmark. | **DELETE** the attribute. |

### Pokédex detail

| file:line | Current text | Problem | Action |
|---|---|---|---|
| DET:105-108 | description `${name} · Alliance Codex` | Contains no content and is the same in both locales. | **REPLACE**, leaving out any part that is missing:<br>es: `${name} (#${n}) en PokeAlliance: tipo ${tipos}, tier ${tier}, función ${función}, nivel ${nivel}, generación ${gen}.`<br>en: `${name} (#${n}) in PokeAlliance: ${types} type, tier ${tier}, ${role} role, level ${level}, generation ${gen}.` |
| DET:136 | alt "Bulbasaur, sprite de PokeAlliance" | The English page shows Spanish text, and the suffix is filler. | **REPLACE** with `alt={record.canonicalName}` in both locales. |
| DET:70,87,145 | eyebrow "Pokédex" | Kicker that repeats the breadcrumb. | **DELETE**, along with WR:2550-2552. |
| DET:125-127 | "#001" in the art corner | none | **KEEP**, but move it into the infobox subtitle, set in Inter tabular (see §4). |
| DET:129-131 | Fallback letter ("B") | Always rendered, and shows through the transparent sprite (see §3). | **DELETE**, except as the image-error state. |
| DET:74-78,91-95,150-155 | Stat labels "Tier / Rol / Nivel / Generación" and "Tier / Role / Level / Generation" | The same field has three names: Rol here, Función at DET:31 and EXP:37. Level is Nivel here but "Nivel mostrado" at DET:28 and EXP:35. | **REPLACE** with StatRow labels:<br>es: "Tier:", "Función:", "Nivel requerido:"\*, "Generación:", "Tipo:"<br>en: "Tier:", "Role:", "Required Level:"\*, "Generation:", "Type:"<br>\*The owner must confirm that roster `level` is the required level. If not, use "Nivel:" / "Level:". |
| DET:151 (and IDX:48 for the grid chip) | "TLegendary", "TSuper Rare", "TULTIMATE", "TMythic", "TUltra Rare" | Data bug: text tiers get a "T" prefix. Affects 80 of 910 records. | **REPLACE** with one shared formatter, using ROS:48-52 logic: numbers become `T${n}`, text is shown as-is. |
| DET:151-154 | "—" values | Filler. 92 records have no tier or function. | **DELETE** the row when the value is missing. Do not print "—". |
| DET:79,96,159 | "Variantes" / "Variants" | A label not tied to the group. | **REPLACE** with a collapsible section title "Variantes: {n}" / "Variants: {n}". |
| DET:166 | "✦ Shiny" / "Normal" | Ambiguous: Smeargle shows 19 identical "Normal" links, Unown shows 2. | **REPLACE** with `variant.canonicalName` (for example "Smeargle Bug", "Unown A", "Shiny Smeargle"). ✦ becomes an `aria-hidden` icon. |
| DET:71,88,191 | h2 "Datos de la ficha" / "Record data" | Heading of a section that is always empty. | **DELETE** (update SMOKE:33). |
| DET:190 | eyebrow "Shiny" / "Normal" | Kicker, hard-coded. | **DELETE**. |
| DET:73,90,193 | "6 campos" / "6 fields" | Meta/pipeline count (fact count minus a magic 2) for a list that never renders. | **DELETE**. |
| DET:72,89,201 | "Sin datos" / "No data" | Unreachable filler. | **DELETE**. |
| DET:24-36 | `factLabels`, including "Ficha disponible / Detail available", "Imagen / Image", "Nivel mostrado / Displayed level" | Developer/pipeline labels, unreachable. | **DELETE**. |
| DET:74,91,209 | nav `aria-label` "Resumen" / "Summary" | Wrong name for prev/next navigation. | **REPLACE**:<br>es: "Pokémon anterior y siguiente"<br>en: "Previous and next Pokémon" |
| DET:69,86,222 | "Volver a la Pokédex" / "Back to Pokédex" | Duplicates the breadcrumb link at DET:117. | **DELETE**, along with WR:2956-2968. |
| DET:80-81,97-98,214,227 | "← Anterior" / "Siguiente →" plus the neighbour's name | none | **KEEP**, with the arrows `aria-hidden`. |

### PokedexGrid

| file:line | Current text | Problem | Action |
|---|---|---|---|
| GRID:39,58,181,190 | "Buscar por nombre, número, tipo o rol" / "Search by name, number, type or role" | none | **KEEP** (a real label). |
| GRID:195 | `<kbd>/</kbd>` | A real shortcut, but it cannot be used on touch screens. | **KEEP** at ≥768px only, and add `aria-keyshortcuts="/"` to the input. |
| GRID:41,60,199 | legend "Todas las variantes" | Wrong group name. | **REPLACE**: es "Variante", en "Variant". |
| GRID:41,60,211 | button "Todas las variantes" / "All variants" | Redundant once the group has a name. | **REPLACE**: es "Todas", en "All". |
| GRID:40,59,219 | `aria-label` "Filtros de la Pokédex" on a plain `div` | The label is ignored on a generic element, and "de la Pokédex" is redundant. | **REPLACE** with `role="group"` and es "Filtros", en "Filters". |
| GRID:44,63,221 | sr-only label "Todas las generaciones" | Labels the field with its default option. | **REPLACE**: es "Generación", en "Generation". **KEEP** the option at :230. |
| GRID:45,64,240 | sr-only label "Todos los tipos" | Same problem. | **REPLACE**: es "Tipo", en "Type". **KEEP** the option at :249. Update SMOKE:50. |
| GRID:46,65,259 | sr-only label "Número Pokédex" on the **sort** select | Wrong accessible name. | **REPLACE**: es "Ordenar", en "Sort". |
| GRID:46-48,65-67,265-267 | options "Número Pokédex / Nombre / Tier" | Looks exactly like a filter. | **REPLACE**: es "Por número", "Por nombre", "Por tier"; en "By number", "By name", "By tier". |
| GRID:276 | `SlidersHorizontalIcon` | Fake control (see §3). | **DELETE**. |
| GRID:49,68,277 | "{n} Pokémon encontrados" / "Pokémon found" | none | **KEEP**. |
| GRID:52,71,280 | "Limpiar filtros" in the results bar | Appears twice when the list is empty. | **KEEP**, but render only when `displayed.length > 0`. |
| GRID:53,72,295 | `aria-label` "Abrir ficha de {name}" / "Open record for" | Replaces the card's content (tier, types, role) with filler. | **DELETE** the attribute. |
| GRID:319 | `title="Outfit #2"` | English-only, internal ID, on an `aria-hidden` node. | **DELETE**. |
| GRID:323 | "✦" badge | Visual scan aid; the name already says "Shiny". | **KEEP**. |
| GRID:331 | role "—" | Filler. | **REPLACE**: render nothing when `role` is null. |
| GRID:332 | "Normal" / "Shiny" in the meta row | Shiny already shows in the name and the ✦; "Normal" on every normal card is noise. | **DELETE**. |
| GRID:328 (via IDX:48) | chip "TLegendary"… | Tier data bug. | **REPLACE** with the shared tier formatter. |
| GRID:348 | "?" ring glyph | Decorative filler. | **DELETE**, along with WR:2374-2384. |
| GRID:51,70,349 | "No hay Pokémon que coincidan con estos filtros." | none | **KEEP**. |
| GRID:52,71,350-352 | "Limpiar filtros" in the empty state | none | **KEEP** (the only copy when the list is empty). |
| GRID:50,69,362-365 | "Mostrar más Pokémon" plus "48 / 910" | none | **KEEP**. |
| GRID:55,74 | `level: 'Tier'` | Unused key. | **DELETE**. |
| GRID:54,73,233 | "Generación {n}" | none | **KEEP**. |

### OutfitPreview

| file:line | Current text | Problem | Action |
|---|---|---|---|
| OUT:156,166,214,217 | "Outfit del juego · #2" / "Game outfit · #2" | "del juego / Game" is redundant on a game wiki, and "#2" is the internal outfit ID. | **REPLACE** with the section title "Outfit" (es and en), and **DELETE** "· #{outfitId}" (update SMOKE:79). |
| OUT:157,167,237 | "Dirección" / "Direction" | none | **KEEP**, as the group's `aria-labelledby`. |
| OUT:163,173 | Sur/Oeste/Norte/Este and South/West/North/East | none | **KEEP**. |
| OUT:158,168,256 | "Aura" | none | **KEEP**. |
| OUT:159,169,261-262 | "Sin aura" / "No aura" (only in aria-label and title; the button shows an Ultra Ball sprite) | Misleading icon. | **KEEP** the text and make it visible; change the icon (see §3). |
| OUT:160,170 | "Alliance Ball" | none | **KEEP** (game term), with visible text. |
| OUT:161,171 | "Premier · prueba" / "Premier · preview" | Status text for a visual whose in-game shader is unverified (the code comment at :18-19 says so). | **DELETE** the option until it is verified. If the owner keeps it, **REPLACE** with "Premier Ball". |
| OUT:162,172 | "La aura no está disponible en este navegador." / "Aura is unavailable in this browser." | Grammar error ("La aura"). The same message also appears when the outfit image fails to load. | **REPLACE**:<br>es: "El aura no está disponible en este navegador."<br>en: "Aura preview isn't available in this browser."<br>Add an image-failure message:<br>es: "No se pudo cargar el outfit."<br>en: "Couldn't load the outfit." |
| OUT:225 | alt "Bulbasaur · south" | English direction key on the Spanish page. | **REPLACE** with `${name}, ${strings.directions[directions.indexOf(direction)]}` (e.g. "Bulbasaur, Norte" / "Bulbasaur, North"). |

### Pokémon tool page

| file:line | Current text | Problem | Action |
|---|---|---|---|
| TPK:16,25,49 | "Comparar Pokémon" / "Compare Pokémon" | Does not cover the second tab. | **KEEP** if the tiers tab moves into the Pokédex (§7 #8). Otherwise **REPLACE**: es "Comparar Pokémon y tiers", en "Compare Pokémon and tiers". |
| TPK:17,26 | "…explora los tiers publicados por la wiki." | Phrased around the data source. | **REPLACE**:<br>es: "Compara dos Pokémon de PokeAlliance lado a lado: tier, función, nivel, tipos y generación."<br>en: "Compare two PokeAlliance Pokémon side by side: tier, role, level, types and generation." |
| TPK:18,27,48 | "Herramientas / Pokémon" | Kicker that repeats the breadcrumb, and it is already `display:none` (WR:512-514), so the markup is dead. | **DELETE**. |
| TPK:19-20,28-29,50 | "Una consulta rápida… no hay recomendaciones inventadas ni fórmulas ocultas." | Meta/process disclaimer. | **DELETE**. |
| TPK:21-22,30-31,41-45 | Breadcrumb | none | **KEEP** (second-level page). |

### PokemonExplorer

| file:line | Current text | Problem | Action |
|---|---|---|---|
| EXP:21,57 | tabs "Comparar" / "Explorar tiers" | none | **KEEP**. Delete the tiers tab if it is folded into the Pokédex. |
| EXP:22,58,249 | "Comparación directa" / "Direct comparison" | Kicker. | **DELETE**. |
| EXP:23,59,250-252 | h2 "Elige dos variantes" / "Choose two variants" | Restates the tab. | **DELETE**; label the panel by its tab. |
| EXP:24-25,60-61,253 | "Consulta los campos publicados… no calcula daño ni decide cuál Pokémon es mejor." | Redundant disclaimer. | **DELETE**. |
| EXP:26,62,257 | "Filtrar opciones" / "Filter options" | Developer wording. | **REPLACE**: es "Buscar Pokémon", en "Find Pokémon". |
| EXP:27,63,262 | "Nombre o número…" | none | **KEEP**. |
| EXP:28-29,64-65 | "Pokémon A / Pokémon B" | none | **KEEP**. |
| EXP:110-112 | option "001 - Shiny Bulbasaur · Shiny" | The variant is written twice. | **REPLACE** with `record.displayName` only. |
| EXP:296 | eyebrow "Shiny" on the compare card | The name at :297 already says it. | **DELETE**. |
| EXP:298,300 | "#001" and the tier chip on the cards | The table repeats both (:193, :201). | **DELETE** from the cards. A card is sprite plus name, linked to the Pokédex. |
| EXP:30,66,308,312 | "Resumen comparado" used as both the region aria-label and the visible caption | Duplicate label, and the caption is filler. | **REPLACE** with an sr-only caption and label the region by the caption:<br>es: `${A} frente a ${B}`<br>en: `${A} vs ${B}` |
| EXP:31,67,315 | "Campo" / "Field" | Filler header. | **REPLACE** with a visually empty header that keeps sr-only text. |
| EXP:33,69,194-198 | row "Variante" | The name already shows it. | **DELETE**. |
| EXP:35,71,200 | "Nivel mostrado" / "Displayed level" | Pipeline wording. | **REPLACE**: es "Nivel requerido", en "Required level" (pending owner confirmation), otherwise "Nivel" / "Level". |
| EXP:38,74,204 | "Elementos" / "Elements" | The source's field name; the Pokédex calls these "types". | **REPLACE**: es "Tipos", en "Types". |
| EXP:39-41,75-77,136-138,208-212 | "Ficha detallada: Disponible / No indicado" | Pipeline meta that is true for all 910 records. | **DELETE** the row; link each name (:316-317) to `/{locale}/pokedex/{slug}/` instead. |
| EXP:42,78,334 | eyebrow "Pokédex" | Meaningless kicker. | **DELETE**. |
| EXP:43,79,335-337 | h2 "Explorar por tier" | Repeats the tab. | **DELETE** (update SMOKE:469). |
| EXP:44,80,338 | "Filtra variantes por tier, función o tipo…" | Restates the controls and promises a type filter that does not exist. | **DELETE**. |
| EXP:46,82,347 | "Nombre, número o elemento…" | Inconsistent with "tipo". | **REPLACE**: es "Nombre, número o tipo…", en "Name, number or type…". |
| EXP:367 | option "—" | Unlabelled option. | **REPLACE**: es "Sin función", en "No role". |
| EXP:52,88,384 | "910 resultados" | none | **KEEP**. |
| EXP:395 | variant column | The name already shows it. | **DELETE**. |
| EXP:53,89,404 | "Usar en comparar" / "Use in compare" | Clumsy, and it only ever replaces A. | **REPLACE**: es "Comparar", en "Compare" (behaviour fix in §3). |
| EXP:54,90,410 | "No hay variantes que coincidan con esos filtros." | Wording differs from the Pokédex. | **REPLACE**: es "No hay Pokémon que coincidan con estos filtros.", en "No Pokémon match these filters." |
| EXP:398 (via ROS:67-69) | "grass · poison" | Lowercase English in the Spanish UI. | **REPLACE** with the Pokédex type chips. |

---

## 3. Fake or broken controls and dead UI

1. **The facts section is always empty.**
   - DET:51-63 excludes all 8 fact keys the dataset contains, so `visibleFacts` is empty for all 910 records.
   - DET:187-207 therefore renders an eyebrow, the h2 "Datos de la ficha" and "6 campos" (or "4 campos"), with no content.
   - **Fix:** delete the section, DET:24-36, the strings `facts`, `noFact` and `fields`, and WR:2649-2654 and :2880-2918. Update SMOKE:33.
2. **The view-transition name is on every card.**
   - GRID:292 and :315 give every rendered card image `pokemon-art-<slug>`: 48 in the SSR HTML, up to 910 after Load more.
   - On any navigation from the grid, every on-screen named sprite is captured as its own group. Those sprites fade in place above the incoming page, even when the destination is not a Pokédex page.
   - DET:102 and :139 use a per-slug name, so prev/next and variant switches never morph sprite to sprite.
   - **Fix:**
     - Remove the inline names (GRID:292, :315; DET:102, :139).
     - Give the detail sprite one static name: `style="view-transition-name: dex-art"` on the DET hero image.
     - Name only the clicked card. A click-time handler works in every browser with view transitions; `pageswap` needs feature detection.
     - For back navigation, restore the name in `pagereveal`:
       ```html
       <!-- IDX, parser-blocking inline script in <head> -->
       <script is:inline>
       document.addEventListener('click', (e) => {            // forward: name only the clicked card
         const img = e.target.closest?.('.pokemon-card')?.querySelector('img');
         if (img) img.style.viewTransitionName = 'dex-art';
       }, true);
       addEventListener('pagereveal', (e) => {               // back from a detail page
         if (!e.viewTransition) return;
         const from = sessionStorage.getItem('dex:last');     // set by DET on pageswap
         const img = from && document.querySelector(`.pokemon-card[href="${from}"] img`);
         if (!img) return;
         img.style.viewTransitionName = 'dex-art';
         e.viewTransition.finished.finally(() => { img.style.viewTransitionName = ''; });
       });
       </script>
       ```
     - In DET, add `addEventListener('pageswap', () => sessionStorage.setItem('dex:last', location.pathname))`.
     - Add `view-transition-class: sprite` and `::view-transition-group(dex-art){animation-duration:320ms;animation-timing-function:cubic-bezier(.22,1,.36,1)}`.
     - For reduced motion, use `@media (prefers-reduced-motion: reduce){@view-transition{navigation:none}}` in place of WR:3133-3136.
     - Move WR:1734-1742 out of the Pokédex block into the motion tokens, because it is site-wide.
3. **The `?q=` link never filters.**
   - IDX:54 reads `Astro.url.searchParams` on a prerendered page. That is empty at build time; the built HTML serializes `initialQuery` as `""`.
   - GRID:158-164 still writes `?q=` on submit, so the URL looks shareable but a reload shows the full list. The filters and sort never reach the URL.
   - **Fix:** in the mount effect (GRID:101-116), read `location.search` for q, variant, gen, type and sort. Write every change back with `replaceState`, and remove the `initialQuery` prop.
   - The same bug exists outside this scope at `src/pages/[locale]/buscar/index.astro:49`.
4. **Fake control.** GRID:276 `SlidersHorizontalIcon` sits next to the count and looks like a filter button, but does nothing. Delete it.
5. **Duplicate "Limpiar filtros".** GRID:279-283 and :350-352 both render when the list is empty; SMOKE:59 depends on this through `.last()`. Show the results-bar button only when `displayed.length > 0`.
6. **The fallback letter shows through sprites.**
   - GRID:307 and DET:129-131 always render the fallback letter in a ringed circle, even when the image loads.
   - It sits under the transparent PNG sprite (WR:2228-2242, :2536-2540), and SMOKE:34 asserts it is visible.
   - **Fix:** `.pokemon-card-visual:has(img) .pokemon-art-fallback, .pokemon-profile-art:has(img) .pokemon-art-fallback{display:none}`. The existing `onError` / `onerror` handlers remove the image, so the fallback appears only on failure. Update SMOKE:34.
7. **Variant links cannot be told apart.** DET:157-171 on Smeargle (#235, 20 links) and Unown (#201) produce several links named "Normal". Label each with its `canonicalName` (§2).
8. **The "Sin aura" button shows an Ultra Ball.** OUT:258-275 uses `/images/ball_ultra_ball.png` for "no aura", which suggests an Ultra Ball aura. Use a "none" glyph plus visible text ("Sin aura" / "No aura").
9. **Wrong error message on image failure.** OUT:200-202 sets `error` when the outfit image fails, and OUT:314-318 then says the aura is unavailable, even with aura set to none. Keep separate `imageError` and `auraError` states.
10. **Unverified Premier aura.** OUT:294-311 ships a Premier shader that the code itself marks unverified (OUT:18-19). Remove it or gate it until verified. Update SMOKE:101.
11. **Duplicate back link.** DET:222 repeats the breadcrumb link. Delete it.
12. **"Usar en comparar" only fills A.**
    - EXP:215-218 always replaces Pokémon A; nothing can send a Pokémon to B.
    - All 910 buttons have the same accessible name.
    - **Fix:** set B, keep A, and use `aria-label={`${label}: ${record.name}`}`.
13. **Constant row.** EXP:208-212 shows "Ficha detallada: Disponible" for 910 of 910 records. Delete it.
14. **Incomplete tabs.**
    - EXP:222-245: the tablist is labelled "Comparar" (a tab's name).
    - The tabs have no `id`, no `aria-controls`, no roving `tabIndex` and no arrow-key support.
    - The panels (EXP:248, :333) lack `role="tabpanel"`.
    - **Fix:** migrate to `src/components/ui/tabs.tsx`.
15. **Inconsistent disabled state before hydration.** EXP:227 and :238 disable the tabs before hydration, but the inputs and selects (EXP:258-288, :343-380) stay live, so anything chosen before hydration is lost.
16. **Dead markup.** TPK:48 renders an eyebrow that WR:512-514 hides.
17. **Dead CSS.**
    - GL:2330-2342, inside the 680px block at GL:2269-2371, is fully overridden by the second 680px block at GL:2373-2398.
    - WR:1749 `--dex-screen` and :1751 `--dex-ink` are never used.
    - WR:1839-1841 and :2550-2552 become dead once the eyebrows are deleted.
18. **Faux hardware.** IDX:69-71 (device "lights") and :83 (pokéball mark), styled at WR:1805-1837 and :1882-1918, look like indicator lights but have no meaning. Delete them.
19. **Decorative rings.** GRID:306 `.pokemon-card-orbit` (WR:2165-2196), DET:128 `.pokemon-profile-orbit` (WR:2497-2513) and WR:2486-2495 `.pokemon-profile-art::after`. Delete them.
20. **Load more without JS.** GRID:356-367: before hydration, and without JS, Load more renders but does nothing, and only 48 of 910 Pokémon are reachable.
    - The five SSR controls ship `disabled` (confirmed in dist), which is acceptable.
    - Consider static per-generation pagination links as a no-JS fallback.
21. **Current variant looks like hover.** WR:2642-2647 styles `a[aria-current='page']` exactly like `:hover`, so you cannot see which variant you are on.
22. **Unreachable redirect.** DET:22 redirects when the record is missing, which cannot happen on a prerendered page. Low priority.

---

## 4. Game-layer candidates

| Surface | file:line | Priority | Why |
|---|---|---|---|
| **Pokédex detail infobox** (hero, stats, variants, outfit) | DET:122-207; WR:2461-2918 | **Corte 0 pilot** | The only page that describes a single game entity. The data fits a tooltip `dl` exactly. It is where view transitions land. The empty section and wrong labels have to be removed anyway. |
| Variant picker, becoming a "Variantes: N" section of SpriteSlots | DET:157-171; WR:2608-2647 | Corte 0 pilot | Held-Items-style collapsible pattern. Fixes the identical-label bug. |
| OutfitPreview inside the infobox as an "Outfit" section | OUT:213-320; WR:2656-2878 | Corte 0 pilot | This is the in-world sprite, so it belongs in a beveled slot. Its controls stay in the shell voice with blue selection. |
| Type chips | GRID:334-340; DET:147-149; WR:2312-2327, :2386-2458 | Corte 0, as a token move only | Domain colours stay. Only the size changes (to 12px) and the tokens move to the shared file, so Comercio can reuse them. |
| Pokédex grid card, becoming a mini tooltip card | GRID:294-342; WR:2113-2327 | **First follow-up after the pilot** (high) | It is the source end of the morph, so it should share sprite, title and chip grammar with the detail page. Content changes (§2) can ship in Corte 0; the restyle can wait. |
| Card outfit thumbnail, becoming a SpriteSlot (small) | GRID:318-322; WR:2207-2226 | With the card | Beveled slot at an integer scale. |
| Explorer compare cards, becoming mini tooltips | EXP:292-303; GL:1231-1264 | Later | Explorer data comes from a different dataset. This may be superseded by Comercio's CompareTray. |
| Explorer comparison table | EXP:305-330; GL:1265-1312 | Later; **shell, not game layer** | Tabular comparison belongs to the shell's table voice. |
| Explorer tier list | EXP:387-408; GL:1326-1374 | Later; shell table | Tabular data. |
| Pokédex masthead, toolbar, pager | IDX:67-84; GRID:177-284; DET:209-235 | Corte 0, as shell | Shell voice (Inter, blue actions), not game layer. |

**Pilot anatomy (DET), using the Codex Tooltip tokens**

1. **Shell elements:** the breadcrumb, then an `<article class="cx-unit cx-unit--detail" data-type={primaryType}>`. The card is `--cx-card` with a 1px `--cx-line` border, radius 8 and elevation e0.
2. **Art stage:**
   - Background `--pokemon-type-surface` (the Domain Color Rule keeps this).
   - The sprite sits centred and carries the one `view-transition-name: dex-art`. No orbits, no drop-shadow.
   - "#001" top-left, in Inter tabular 12px `--cx-copy-2`.
3. **Title:** the `h1` is the card title, centred, Poppins 700 at 24px (or the display token). Do not repeat the name anywhere else in the card.
4. **Stat rows:** a `<dl class="cx-stats">` with 21px row pitch and values right-aligned. Each `dt` is Poppins 600 13px `--cx-gold` with a colon; each `dd` is Inter 500 13px tabular `--cx-value`.
   - es: Tier:, Función:, Nivel requerido:\*, Generación:, Tipo: [type chips]
   - en: Tier:, Role:, Required Level:\*, Generation:, Type: [type chips]
   - \*Pending owner confirmation, as in §2.
   - Leave out any row with no value.
5. **Variants section:** `<details class="cx-section">` with the centred summary "Variantes: {n}" / "Variants: {n}" and a thin chevron. Render it only when n > 1. Each variant is a beveled SpriteSlot link with its name; the current one gets a `--cx-blue-hi` ring, a check icon and `aria-current`.
6. **Outfit section:** `<details class="cx-section">` "Outfit", only for mapped species.
   - The stage is a recess-coloured, beveled slot at an **integer** scale.
   - "Dirección" and "Aura" become base-ui ToggleGroups with visible text.
   - The selected option gets a blue ring, a check and text. No per-ball glows.
7. **Pager:** below the card, in the shell voice. No back link.
8. **Not included:** no compact or training meter (the Pokédex has no progress data; do not invent any), no footer hint, and no gold CTA. The "En el mercado" strip (synthesis §4.7) comes later.

---

## 5. Migration notes

### 5.1 Tokens

- **`--dex-*` (WR:1746-1751).** Keep the family as domain tokens and move it to the shared token file.
  - `--dex-red` is used only at WR:1780 and :2026. `--dex-red-dark` only at WR:1772 and :1917.
  - `--dex-amber` (:1817) and `--dex-paper` (:1824) serve only the device lights, so they die when the lights are deleted.
  - `--dex-screen` and `--dex-ink` are unused today.
  - **Decision needed:** DESIGN.md:93 says Pokédex red marks "controles activos", but Codex Tooltip requires a blue ring plus icon plus text for selection. I recommend limiting `--dex-red` to page identity (for example the 0.55rem strip WR:2991-2994 already uses on mobile) and moving active states to blue (WR:2025-2028). DESIGN.md:93 must then be updated.
- **Type palette (WR:2386-2458, `--pokemon-type` / `--pokemon-type-surface` for 18 types).** Keep the values.
  - Today they are scoped to `:is(.pokemon-card, .pokemon-profile-page, .pokemon-types > span)[data-type]`, so EXP (ROS:67-69) and Comercio cannot use them.
  - Move them to `:root` as `--type-{name}` and `--type-{name}-surface`, plus a generic `[data-type]` hook.
  - Chip text contrast is at least about 4.96:1 (electric is the lowest); number-on-surface is at least about 7.1:1. Both pass.
- **`--wiki-*` in scope** (tertiary, secondary, disabled, line, copy) should resolve to `--cx-*` aliases as described in the audit.

### 5.2 Colours (WR unless GL is named)

| Target | Lines |
|---|---|
| `--cx-card` #1D232B | 2119 card, 2473 hero, 2589 stat cells, 2662 outfit panel |
| `--cx-surface` #161B22 | 1937 toolbar (make it opaque; drop the /0.97), 2338 load more, 2369 empty state, 2652 profile section (deleted) |
| `--cx-recess` #12161C | 1949 and 1958 search, 1997 switch track, 2050 select, 2218 card outfit slot, 2631 variant slot, 2672 outfit stage |
| `--cx-raised` #262B32 | 1985 kbd, 2059 select hover, 2348 load-more hover, 2645 variant current, 2752 pressed direction |
| `--cx-line` #2E3540 (decorative) | 1770, 2117, 2148 (or keep the type-mixed divider), 2367 (make solid), 2579 and 2581 (delete the gap grid; tooltips have no separators), 2670, 1983 |
| **`--cx-line-strong` #646D7C** (controls need 3:1) | 1947 (1.86:1 today), 1995 (1.53:1), 2047 (1.38:1), 2336, 2629 (1.61:1), 2727 (1.56:1) |
| `--cx-value` #FEFEFE | 1845, 1875, 2027, 2280, 2556, 2603, 2646, 2753 |
| `--cx-copy`, `--cx-copy-2`, `--cx-muted` | `var(--wiki-copy)` at 1973, 2018, 2091, 2120, 2339, 2743, 2820, 2846, 2915, 2967 → copy<br>`--wiki-copy-secondary` at 2052, 2633, 2731, 2932 → copy-2<br>`--wiki-copy-tertiary` at 1987, 2007, 2076, 2306, 2356, 2370, 2595, 2615, 2678, 2774, 2869, 2892, 2942, 2960 → muted, or copy-2 when it is control text<br>1950 icon → muted<br>1978 placeholder → muted |
| **`--cx-blue-hi` #68C0FF** (links and focus) | 1957 focus-within, 2058 select focus (2.96:1 today), 2100 clear text-button, 2742 direction focus (type colour today), 2826 and 2837-2839 plus 2857-2861 ball focus (`outline:none` plus accent ring), 2953 and 2966 link hover (type colour today) |
| Selection: blue-hi 1px ring, icon and text | 2025-2028 (`--dex-red` fill today), 2642-2647, 2750-2754, 2845-2865 |
| Delete (decorative) | 1770-1791, 1815-1836, 1840, 1855, 1863, 1890-1917, 2171-2195, 2379-2381, 2486-2513 |
| Shiny badge (2258-2261) | oklch(0.88 0.15 90) sits next to the game-label gold #E8C66A, which critique #9 forbids for a different meaning. Use a neutral chip (`--cx-raised` / `--cx-value`) or a separate `--dex-shiny` hue. |
| Per-ball accents (2780, 2784, 2788; `--ball-accent` 2764-2864) | Delete. The sprite identifies the ball; selection is blue. |
| **GL (EXP)** | 1142, 1267, 1278, 1287, 1318, 1330, 1337 → `--cx-line`<br>1149 → copy-2<br>1158 and 1242 `--accent` → blue-hi for the tab underline; the compare card's 2px left border becomes a 1px `--cx-line` border<br>1159, 1174, 1248, 1306, 1347 → value<br>1181, 1205, 1293, 1302 → copy-2<br>1215 → line-strong<br>1217 → recess<br>1219, 1339 → copy<br>1224 placeholder #68717c (3.82:1) → muted<br>1228 (focus with `outline:0`) → blue-hi ring<br>1243 → card<br>1255, 1320, 1354 → muted<br>1260 and 1357 gold tier **values** → value (gold is for labels only)<br>1269 → surface<br>1361, 1365, 1372, 1373 gold action button → ui/button outline in blue (WR:1459-1479 already partly overrides these) |

### 5.3 Typography

With a 16px root, these sizes in scope fall **below the 12px floor**:

| Size | Lines |
|---|---|
| 0.57rem (9.1px) | 2297 |
| 0.58rem (9.3px) | 2358, 2597, 2617, 2944 |
| 0.59rem (9.4px) | 2308, 2325 |
| 0.6rem (9.6px) | 1869, 2894 |
| 0.61rem (9.8px) | 2680 |
| 0.65rem (10.4px) | 1989, 2961 |
| 0.67rem (10.7px) | 2634 |
| 0.68rem (10.9px) | 2570, 2870 |
| 0.7rem (11.2px) | 2008, 2053, 2077, 2101, 2159, 2732 |
| GL | 1205, 1294 (0.64rem); 1257, 1322 (0.66rem); 1366 (0.68rem); 1262 (0.72rem) |

**Mapping by element**

- **Display titles** (1843-1850, 2554-2562, 3010-3012, 3095-3097): clamp up to 4.75rem, weight 760, tracking −0.065em. Replace with Poppins 700 at `clamp(28px,3vw,40px)` (or 24px inside the card), tracking 0, and delete the overrides. The `.display-title` base style (455-463) uses Verdana via `--font-display`; switch it to Poppins.
- **Card title** (2278-2287, 3073-3075): Poppins 600 16px, allow two lines, and remove `nowrap` and the ellipsis.
- **StatRow `dt`** (2593-2600, currently mono, uppercase, 0.07em): Poppins 600 13px/21px `--cx-gold`, Title Case with colon, no text-transform.
- **StatRow `dd`** (2602-2606): Inter 500 13px tabular.
- **Chips:**
  - Type chips (2319-2327, 2568-2571): Inter 600 12px.
  - Tier chip (2289-2299, currently mono): Inter 600 12px tabular.
  - Shiny badge (2249-2263): 12px.
- **Numbers:** card number (2152-2163), profile number (2515-2525), count (1874-1880, deleted), results count (2090-2094) and load-more count (2355-2359) move from mono to Inter tabular 12-13px.
- **Mono** stays only for kbd (1981-1990), through `ui/kbd.tsx`.
- **Remove uppercase and tracking:** 1868-1871, 2301-2310, 2593-2600, 2614-2620, 2676-2684, 2941-2946, and GL 1204-1209, 1292-1298, 1317-1324.
- **Shell controls** go to 14px Inter: 1966-1975 search, 2001-2010 switch, 2043-2054 select, 2096-2105 clear, 2329-2345 load more, 2725-2733 direction, and GL 1211-1222.
  - Inputs and selects must be 16px below 768px, or iOS Safari zooms on focus. Today they are 13.1px (1974), 11.2px (2053) and 12.5px (GL:1221).
- **Weights:** 760 and 750 become 700; 680, 650 and 620 become 600. Poppins is static 600/700.
- **Fallback letter** (2228-2242, 2536-2540): Poppins 700, shown only on image error.

### 5.4 Radii

| Target | Lines |
|---|---|
| 6px, controls and chips | 1948 (.625rem), 1984, 1996, 2004 (.4rem), 2048 (.5rem), 2292 (.35rem), 2321 (999px pill), 2337 (.75rem, a button), 2728 (.45rem), 2958, GL 1216 (5px), GL 1362 (4px) |
| 8px, cards | 2118 (.9rem), 2472 (1.2rem), 2661 (1rem) |
| 12px, shell panels | 1771, 2988 (masthead, if kept), 1936 (.875rem toolbar), 2368 (1rem empty state), 2651 (deleted section) |
| Bevel slot (`corner-shape: bevel`, 4px fallback) | 2217, 2630, 2671, and the 2771/2797 ball circles |
| 0 | the 2580 stat grid (remove it) |
| Delete (decorative 50% circles) | 1816, 1891, 1916, 2172, 2194, 2236, 2380, 2493, 2504 |

### 5.5 Elevation and filters

- **e0 (border only):** 1773 masthead, 1939 sticky toolbar (use solid `--cx-surface` plus a bottom `--cx-line`), 2474 hero.
- **e1 `0 6px 16px rgb(0 0 0/.28)`:** 2134 card hover.
- **Delete** (no glow, no decorative drop-shadow): 1818, 1826-1828, 2203, 2533 (sprite drop-shadows), 2799, 2833, 2852-2854, 2858-2860, 2864.

### 5.6 Motion

| Current | Lines | Target |
|---|---|---|
| 220ms view-transition group | 1740 | Morph group d5 320ms. Root crossfade d3 200ms, exit `cubic-bezier(.4,0,1,1)` at 0.7×. |
| 180ms | 1951-1953, 2342-2344 (plus 120ms), GL 1152-1154, GL 1367-1369 | d2 140ms `var(--ease-out)` |
| 160/100ms | 2011-2014, 2637-2639 | d2 / d1 |
| 220ms card and 260ms sprite | 2124-2127, 2204 | d2. Hover lift ≤2px, no `scale(1.07)`, no `translateY(-0.3rem)`. |
| 160–180ms `ease` (not the token curve) | 2734-2737, 2776, 2800-2804, 2814-2816 | d2 ease-out |
| Press transforms | 2022, 2139 (scale 0.99), 2352, 2747, 2842 | d1, `translateY(1px)` only |
| Hover scales | 2821, 2828 (1.035), 2834 (1.08) | Delete (they also blur pixel art) |
| Reduced motion | 3133-3151 | Replace the 1ms group with `@view-transition{navigation:none}`. Cover the missing rules: 1951, 2139 (`:active` is not reset), 2637, 2734-2747, 2776-2842, and GL 1152 and 1367. |

### 5.7 Touch targets under 40px

| Element | Lines | Size today |
|---|---|---|
| Variant switch buttons | 2002 | 2.25rem = 36px |
| Selects | 2045 | 39.2px |
| Direction buttons | 2726 | 36px |
| Variant links | 2628-2636 | about 30px |
| Back link | 2956-2963 | about 31px |
| Clear text-buttons | 2096-2105 | no height set |
| Prev/next links | 2929-2934 | no minimum height |
| Explorer tabs | GL:1144-1148 | about 23px |
| Tier-row action | GL:1360-1366 | about 27px |

Set all of them to at least 40px.

### 5.8 Sprites and media

- **Non-integer `pixelated` scaling:**
  - OUT:152 `Math.min(3.5, 224/max)` gives 3.5× for both 32px and 64px outfits. Use `Math.floor`, which gives 3×. The CSS is at WR:2694 and :2702.
  - Card outfit at WR:2221-2226 is 40px for 32px or 64px sprites (1.25× or 0.625×). Use 32px (1×), or smooth scaling below 1×.
  - Ball icons at WR:2807-2817 are 40.8px for 32px sprites, plus `translateX(-2px)`. Use 32px or 64px.
- **Hotlinked art.** PM:1-6 loads every sprite from wiki.pokealliance.com at runtime. Mirror the images at build time, as the outfits manifest already does.
- **Missing image attributes.** GRID:308-317 and DET:133-141 have no `width`/`height`, which causes layout shift. The detail sprite is the LCP image but has no `fetchpriority="high"`.
- **Inline handler.** DET:138 uses an inline `onerror`. Prefer the CSS `:has()` fallback from §3.6.

### 5.9 Bespoke classes and their target components

| Current | Target |
|---|---|
| `.pokemon-profile-*`, `.pokemon-profile-stats`, `.pokemon-detail-facts` | `UnitTooltip variant="detail"` plus `StatRow` |
| `.pokemon-variant-picker` | `Section` plus `SpriteSlot` links |
| `.outfit-preview*` | `Section` plus `SpriteSlot`; base-ui ToggleGroup for direction and aura, with visible labels |
| `.pokemon-card*` | `UnitTooltip variant="card"` (in the follow-up) |
| `.pokemon-tier` | Neutral `Badge` |
| `.pokemon-types` | `TypeChip` (domain colours) |
| `.pokedex-search-field` | `ui/input` plus `ui/kbd` |
| `.pokedex-variant-switch` | ToggleGroup |
| `.pokedex-selects` | Styled select primitive (still missing from `ui/*`) |
| `.pokedex-load-more` | `ui/button` outline |
| `.pokedex-results-bar button`, `.pokedex-empty button` | `ui/button` link or ghost |
| `.pokedex-empty` | Shared empty state |
| `.pokedex-masthead` | `.wiki-page-header` |
| `.pokemon-profile-pagination` | Shell pager |
| `.tool-tabs` / `.tool-tab` | `ui/tabs.tsx` |
| `.tool-field` | `ui/input` plus select |
| `.compare-record` | Mini `UnitTooltip` |
| `.tool-table`, `.tier-list` / `.tier-row` | Shell `<table>` with column headers |
| `.tier-row-action` | `ui/button` outline, ≥40px |

- **Sticky toolbar offsets:** WR:1930 and :3028 hard-code `4.25rem` and `3.85rem`; derive them from `--wiki-topbar-height`.
- **Breakpoints:** WR:2874 (640), 2970 (1023), 2985 (767), 3110 (390) and GL:2269 and :2373 (680) should map to <768, 768–1279 and ≥1280.

### 5.10 Tests to update deliberately

- SMOKE:33 ("Datos de la ficha")
- SMOKE:34 (fallback visible)
- SMOKE:50 (`getByLabel('Todos los tipos')`)
- SMOKE:59 (`.last()` on the clear button)
- SMOKE:79 ("Outfit del juego · #id")
- SMOKE:101 ("Premier · prueba")
- SMOKE:106 (keep the accessible name "Sin aura")
- SMOKE:468-469 (tiers tab and heading)

---

## 6. i18n parity and accessibility

**i18n**

- **Key parity is complete.** IDX has 6 keys per locale, DET 15, GRID 18, OUT 8, TPK 6 and EXP 34.
- **Hard-coded, single-language strings:**
  - DET:136 alt (Spanish on the English page)
  - OUT:225 (English direction key on the Spanish page)
  - GRID:319 "Outfit #" (English)
  - DET:166 and :190 "Normal" / "Shiny" (acceptable as game terms)
  - EXP:365-367 "PVE", "PVP", "—"
  - `src/lib/content/repository.ts:85` "Yes" / "No", which is latent today because `detailAvailable` is filtered out
- **Type names are English in the Spanish UI:** GRID:252 and :337, DET:148 (capitalized), and EXP through ROS:67-69 (lowercase). The GRID search haystack (:138-140) only matches English, so a search for "fuego" finds nothing. **Owner decision:** localize the types (Planta, Veneno…) and search both forms, or keep the game form.
- **Tier text comes from the data in English and in mixed case** ("ULTIMATE" vs "Super Rare"). Keep it as game data, or normalize the display.
- **The same field has three labels in each language:** Rol, Función and Nivel vs Nivel mostrado (DET:77, DET:31, EXP:37; DET:75, DET:28, EXP:35).
- **Outside scope but affecting these pages:** the locale switch and `hreflang` always point to `/{locale}/` (AppLayout.astro:97-98, :130-139), so switching language on a detail page loses the Pokémon.
- **The same meta description in both locales:** DET:108.

**Accessibility**

- **Accessible names:**
  - GRID:295 `aria-label` hides tier, type and role from screen readers.
  - GRID:219 `aria-label` on a plain `div` is ignored.
  - GRID:199, 221, 240 and 259 have wrong names.
  - EXP:222 mislabels the tablist.
  - DET:209 mislabels the prev/next nav.
  - EXP:305 plus :312 give the table a duplicate name.
  - OUT:238-242 and :257 duplicate the visible labels; use `aria-labelledby`.
  - OUT:261-262 duplicate `aria-label` and `title`.
- **Live regions:** GRID:274 `aria-live` wraps the clear button too. Scope it to the count only.
- **Control contrast (WCAG 1.4.11):** borders measure 1.38:1 (WR:2047), 1.86:1 (1947), 1.53:1 (1995), 1.61:1 (2629) and 1.56:1 (2727). Select focus is a border at 2.96:1 with `outline:0` (2049, 2058). The ball toggle has `outline:none` (2837-2839). The global focus colour #444ce7 measures 3.16:1. Use `--cx-line-strong` (3.03:1) and a `--cx-blue-hi` 2px ring.
- **Text contrast:** the current breadcrumb item uses `--wiki-copy-quinary` #61656c at 3.30:1 (WR:487), which fails. The explorer placeholder is #68717c at 3.82:1 (GL:1224).
- **Breadcrumbs:** the separators (IDX:64; DET:116, :118; TPK:42, :44) are not `aria-hidden`, and the current item has no `aria-current="page"`.
- **Selection state:**
  - The current variant is identical to hover (WR:2642-2647).
  - The ball pressed state is a faint, accent-coloured glow (WR:2845-2865), and the ball buttons are icon-only with no visible text (OUT:258-311).
  - Add a blue ring, a check icon and visible text.
- **Structure:**
  - EXP:388-408 is a 6-column grid of divs with list roles and no column headers; use a `<table>`.
  - The tabs have no keyboard pattern (EXP:223-244).
  - DET:159 has no group association.
- **Truncation:** long names ("Shiny Smeargle Electric") are cut with an ellipsis and no alternative (WR:2278-2287).
- **Shortcuts:** the search input needs `aria-keyshortcuts` (GRID:183-194), and the `/` hint should be hidden on touch devices.
- **Screen-reader noise:** DET:214, :227 and :166 announce the arrow and ✦ glyphs; make them `aria-hidden`.
- **Text floor, touch targets and reduced motion:** see §5.3, §5.6 and §5.7.
- **What already works:** empty `alt` on the grid sprite (GRID:310), `aria-current` on variants (DET:164), `role="search"` (GRID:177), `role="status"` for the aura error (OUT:315), the reduced-motion check in OUT:180, and the `aria-hidden` canvas (OUT:231).

---

## 7. Top 10 fixes, ranked

1. **Build the Corte 0 pilot on the detail page.**
   - Replace DET:122-207 with the Codex Tooltip infobox: StatRows with unified labels, collapsible Variantes and Outfit sections.
   - Delete the always-empty "Datos de la ficha" section, its "N campos" count, the eyebrows, the back link and `factLabels`.
   - Fix the English alt and the meta description.
   - This one change removes most of the detail-page slop and becomes the pattern for later cortes.
2. **Fix the view-transition naming.** Name only the clicked card, give the detail sprite one stable `dex-art` name, restore the name via `pagereveal` and sessionStorage, use d5 at 320ms, and switch reduced motion to `navigation:none`. Lines: GRID:292, :315; DET:102, :139; WR:1734-1742, :3133-3136.
3. **Fix the tier label bug.** 80 records show "TLegendary" and similar (IDX:48, DET:151). Use one shared formatter (ROS:48-52) and one shared label set for the Tier, Función and Nivel fields across DET, GRID and EXP.
4. **Purge the Pokédex masthead.** Remove the eyebrow, intro, duplicate roster count, faux device lights and pokéball mark (IDX:20-23, 28-31, 67-84; WR:1765-1918, :2970-3025). Use a plain shell page header instead.
5. **Fix the grid controls.**
   - Correct the accessible names, make the sort labels "Por número / By number…", and add `role="group"` (GRID:199-270).
   - Remove the fake sliders icon (:276) and the duplicate clear button (:280).
   - Make `?q=` and the filters actually round-trip through the URL (IDX:54; GRID:101-164).
6. **Clean up the card content.** Remove the `aria-label` override, the "Normal"/"Shiny" meta row, the "—" role, the outfit `title` and the decorative orbit; hide the fallback letter unless the image fails. Lines: GRID:295-341; WR:2165-2242.
7. **Bring the Pokédex controls to the contrast, focus, size and touch floor.** Control borders are 1.38–1.86:1, select focus is 2.96:1 with `outline:0`, targets are 36px, 25 declarations are under 12px, and inputs are under 16px on iOS. Map them to `--cx-line-strong`, `--cx-blue-hi`, 40px targets and the 12/13/14/16 scale (§5.2–5.7).
8. **Rework PokemonExplorer.**
   - Purge TPK:18-20 and the EXP eyebrows, headings and disclaimers.
   - Remove the "Ficha detallada" and "Variante" rows; rename "Nivel mostrado" and "Elementos".
   - Move the tabs to `ui/tabs`, turn the tier list into a table, and make "Comparar" set B.
   - Switch EXP to the normalized repository so the names can link to the Pokédex.
   - Consider folding "Explorar tiers" into the Pokédex as Tier and Función filters.
9. **Fix OutfitPreview.**
   - Replace the misleading Ultra Ball "Sin aura" icon and remove the unverified Premier aura.
   - Split image errors from aura errors and fix "La aura".
   - Localize the alt, drop the outfit ID, and use integer pixel scaling (OUT:152).
   - Show selection with a blue ring, a check and visible text.
10. **Finish the media and token migration.**
    - Self-host the Pokémon art (PM:1-6) with `width`/`height` and `fetchpriority` on the detail sprite.
    - Convert the remaining WR Pokédex literals to `--cx-*`: radii 6/8/12 plus bevel, e0/e1 elevation, d1–d5 motion.
    - Keep `--dex-*` and the 18 type palettes as domain tokens in the shared file, and delete the dead tokens and CSS (WR:1749, :1751; GL:2330-2342).
    - Update the tests listed in §5.10.