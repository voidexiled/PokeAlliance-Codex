# Corte 0 audit: content pages and Comercio (guias, sistemas, rotaciones, comercio)

I read every in-scope file, the rendered `dist/client/{es,en}/**/index.html`, the shared CSS it depends on, the tests that touch it, and the prior research. I changed no repo files. The only scratch file I wrote is `C:/Users/jalom/AppData/Local/Temp/claude/C--Users-jalom-Documents-ChatGPT-PokeAlliance-Codex/ad16e56a-0cd4-433d-aab8-9015e990e27d/scratchpad/corte0-contrast.mjs` (contrast checks). It sits in the scratchpad root, not in `corte0/`.

**File abbreviations used below**

| Short name | Path |
|---|---|
| `guias` | `src/pages/[locale]/guias/index.astro` |
| `sistemas` | `src/pages/[locale]/sistemas/index.astro` |
| `rotaciones` | `src/pages/[locale]/rotaciones/index.astro` |
| `comercio` | `src/pages/[locale]/comercio/index.astro` |
| `TD` | `src/components/trade/TradeDesk.tsx` |
| `trade.css` | `src/styles/trade.css` |
| `guides.css` | `src/styles/guides.css` |
| `wref.css` | `src/styles/wiki-reference.css` |
| `smoke` | `tests/e2e/smoke.spec.ts` |
| `repo.ts` | `src/lib/content/repository.ts` |

Where a row gives two line numbers such as `:25/:36`, the first is the `es` copy and the second is the `en` copy.

---

## 1. Inventory

| Route or file | Purpose |
|---|---|
| `/{es,en}/guias/` (`guias`, 171 lines) + `guides.css` (308) | Lists the quest records (1 quest: Porygon / Dr. Vektor) with required level, steps and rewards. Also lists the location records (1: Saffron) with access and travel info. It uses bespoke purple/green "hero" cards. |
| `/{es,en}/sistemas/` (`sistemas`, 129) | Lists item records (1: Normal charger) and move records (1: Scratch) as `wiki-panel` cards. The title promises "systems", but the page only shows items and moves. |
| `/{es,en}/rotaciones/` (`rotaciones`, 94) | Lists rotation/tier assertions (1: Special Shiny tiers, Primal Area) with value, context and comparison set. |
| `/{es,en}/comercio/` (`comercio`, 60) | Page shell: breadcrumb, a bespoke header (kicker, h1, intro, decorative ball), and it maps the 910 roster records into props for `<TradeDesk client:load>`. |
| `TD` (776 lines) | Session-only listing composer. It has a Sell/Buy toggle, 4 asset tiles, and asset-specific fields: quantity; item name; Pokémon via a 910-option datalist, core fields, extra attributes, 8 training skills, Ditto memory. It also has price or "negotiable", a sticky preview, and clipboard copy. Nothing is persisted. |
| `trade.css` (1024 lines) | Two stacked skins. Lines 1–701 are a blue oklch skin. Lines 703–1024 re-skin the same selectors in green-graphite hex. It also holds dead selectors. |
| `public/trade/sprites/ball.svg` | Editorial 64-unit pixel-art Poké Ball (`crispEdges`). Used as the Pokémon tile fallback (`TD:187`), the Ball input adornment (`TD:491`), the page mark (`comercio:55`) and the sidebar nav icon (`src/layouts/AppLayout.astro:210`). |
| `public/trade/sprites/diamond.svg` | Editorial Diamonds glyph: tile, preview art and header sprite (`TD:182`). |
| `public/trade/sprites/kks.svg` | Editorial gold-coins glyph (`TD:183`). |
| `public/trade/sprites/item.svg` | Editorial item box: tile, generic item adornment and fallback (`TD:189,406,411`). |

Supporting data, all English-only with no localizations: `data/normalized/{quests,locations,items,moves,rotation-tier-assertions}.sample.json`, one record each.

Tests that depend on this scope:
- `smoke:114-147` (the trade flow; asserts the texts `Copiar anuncio`, `Cantidad`, `Pokémon o variante`, `Slots totales`, `Memoria N`, `Nombre del item` and `Precio NPC: aún no verificado en el catálogo`, and button roles for the tiles);
- `smoke:209-219` (overflow check on all 4 routes);
- `smoke:369-372` (the `Guías` heading and quest name).

---

## 2. Content slop

These are the categories used in the table:
- **INTRO**: intro restating the title
- **META**: text about the project, pipeline or status
- **DEV**: developer-facing text, raw data tokens or key:value dumps
- **KICK**: decorative kicker or eyebrow
- **DUP**: duplicated label
- **DISC**: redundant disclaimer
- **BADGE**: badge that adds nothing
- **FILL**: filler or placeholder
- **I18N**: wrong language
- **WRONG**: label is inaccurate

### Guías

| file:line | loc | Current text | Cat. | Action |
|---|---|---|---|---|
| `guias:23/:34` | es/en | "Guías" / "Guides" (title) | – | KEEP |
| `guias:24/:35` | es/en | "Misiones, recompensas, ubicaciones y rutas de PokeAlliance." (meta) | – | KEEP. Accurate and names the game. |
| `guias:25/:36`, render `:71` | es/en | "Misiones, recompensas y rutas disponibles en el archivo." / "…available in the archive." | INTRO, META | DELETE the key and the `<p class="muted-copy">`. PRODUCT.md:25 and DESIGN.md:195 already ban intro text. |
| `guias:63` | es/en | breadcrumb `aria-label` "Ruta de navegación" / "Breadcrumb" | – | KEEP |
| `guias:61-68` | es/en | "Inicio / Guías" | DUP | DELETE on top-level routes. It repeats the h1 (`:70`) and the active sidebar item. This is a site-wide decision; keep breadcrumbs on deep routes such as `pokedex/[slug]`. |
| `guias:77` | both | bare count "1" in mono | BADGE | DELETE |
| `guias:85` | both | "Quest", hard-coded English in `es` | KICK, I18N | DELETE. It duplicates the h2 "Misiones". |
| `guias:87` | both | quest summary (English data on `es`) | – | KEEP. It helps the player. See §6 for the missing `lang="en"`. |
| `guias:28/:39`, `:88-93` | es/en | "Nivel requerido" / "Required level" chip | – | REPLACE with a StatRow label: es "Nivel requerido:", en "Required Level:" |
| `guias:97` | both | "P" monogram fallback | FILL | DELETE |
| `guias:29/:40` | es/en | "Pasos" / "Steps" | – | KEEP |
| `guias:108` | both | "01"…"06" zero-padded inside an `<ol>` | DUP | REPLACE with "1"…"6", marked `aria-hidden`. Screen readers currently hear the number twice. |
| `guias:30/:41` | es/en | "Recompensas" / "Rewards" | – | KEEP |
| `guias:119` | both | "✦" bullet | FILL | DELETE |
| `guias:27/:38` | es/en | "Ubicaciones y viaje" / "Locations & travel" | – | KEEP |
| `guias:135` | both | bare count "1" | BADGE | DELETE |
| `guias:146` | both | `{kind ?? 'location'} · {region ?? '—'}` renders as "city · Kanto" | DEV, I18N | REPLACE through a label map: es "Ciudad · Kanto", en "City · Kanto". Omit the region when it is missing; never show "—". |
| `guias:31/:42`, `:149` | es/en | "Ruta de viaje" / "Travel route" | WRONG | REPLACE with two labels, because the list mixes access requirements (`:151-156`) with travel connections (`:157-162`): es "Acceso:" + "Viaje:", en "Access:" + "Travel:". |
| `guias:160` | both | `formatFactValue(connection)` renders as `mode: Teleport · command: h "saffron` | DEV | REPLACE with the same text in both locales: "Teleport: `h "saffron`". Put the command in `<code>`. |
| (not rendered) `quests.sample.json` facts `prerequisites`, `instructions` (45-minute limit), `notes[0..1]` | – | useful player info that is missing | – | ADD later (Corte 2 infobox). Never render `notes[2]` "Coordinates are not supplied by the source page." It is META. |

### Sistemas

| file:line | loc | Current text | Cat. | Action |
|---|---|---|---|---|
| `sistemas:18/:30` | es/en | "Sistemas" / "Systems" | – | KEEP. Note the IA mismatch: the content is items and moves. |
| `sistemas:19/:31` | es/en | "Objetos y movimientos que ayudan a entender los sistemas de PokeAlliance." | FILL | REPLACE. es: "Objetos y movimientos de PokeAlliance: efectos, elemento, slot y cooldown." en: "PokeAlliance items and moves: effects, element, slot and cooldown." |
| `sistemas:20/:32`, render `:65` | es/en | "Wiki Core / Sistemas" / "Wiki Core / Systems" | KICK, DEV | DELETE. "Wiki Core" is the roadmap phase name. It is hidden by `wref.css:512` but still ships in the DOM. |
| `sistemas:21/:33`, render `:67` | es/en | "Consulta de forma directa qué hace cada objeto…" / "See what each item does…" | INTRO | DELETE |
| `sistemas:22/:34` | es/en | "Objetos de sistema" / "System items" | DEV | REPLACE with "Objetos" / "Items" |
| `sistemas:24/:36` | es/en | "Descripción" / "Description" (unused key) | dead | DELETE |
| `sistemas:73`, `:93` | both | bare counts "1" | BADGE | DELETE |
| `sistemas:80` | both | `{itemKind ?? 'item'}` renders as "training_charger" | DEV, KICK, I18N | REPLACE with the StatRow "Tipo:" / "Type:" and a label map (training_charger becomes "Cargador de entrenamiento" / "Training charger"). Omit when unmapped. |
| `sistemas:100` | both | `{combatMode ?? 'move'}` renders as "PVE" in the kicker | KICK, DEV | REPLACE with the StatRow "Modo:" / "Mode:" and the value "PvE". Omit when unknown. |
| `sistemas:25-27/:37-39`, `:106,:112,:118` | es/en | "Elemento", "Slot", "Cooldown" | – | KEEP the words, rendered as game labels "Elemento:", "Slot:", "Cooldown:". Slot and Cooldown stay as game terms. |
| `sistemas:107,:113` | both | "—" for unknown | FILL | REPLACE with muted es "No informado" / en "Unknown" (StatRow `data-state="unknown"`). |
| `sistemas:119` | both | `formatFactValue(cooldown)` renders as "amount: 12 · unit: second" | DEV | REPLACE with "12 s" |
| `sistemas:56-63` | es/en | breadcrumb | DUP | DELETE (same decision as Guías) |
| (not rendered) move `learnedBy`, item `usedBy` | – | "Aprendido por: Chimchar" / "Learned by: Chimchar" | – | ADD later as a link. It helps the player act. |

### Rotaciones

| file:line | loc | Current text | Cat. | Action |
|---|---|---|---|---|
| `rotaciones:17/:27` | es/en | "Rotaciones y tiers" / "Rotations & tiers" | DUP | KEEP, but align it with the nav label "Rotaciones" / "Rotations" (`src/i18n/config.ts:40,60`). Pick one. |
| `rotaciones:18/:28` | es/en | meta description | – | KEEP |
| `rotaciones:19/:29`, render `:56` | es/en | "Wiki Core / Rotaciones" / "Wiki Core / Rotations" | KICK, DEV | DELETE (hidden by `wref.css:512`) |
| `rotaciones:20-21/:30-31`, render `:58` | es/en | "Las categorías del juego se muestran como afirmaciones de guía, no como hechos universales del canon Pokémon." | META | DELETE. This is data-model methodology, not player info. |
| `rotaciones:66` | both | `{assertionKind ?? 'assertion'}` renders as "availability_scope" | DEV, KICK | DELETE. The h2 already states the category. |
| `rotaciones:22/:32`, `:71` | es/en | "Afirmación actual" / "Current assertion" | DEV | DELETE the label and render the value as the card's lead text. |
| `rotaciones:23/:33`, `:76-78` | es/en | "Contexto" plus "excludedScopes: common respawns, Wildscape · compatibilityCondition: …" | DEV | REPLACE with rows: es "No aparece en:" / en "Not found in:" → "common respawns, Wildscape"; es "Condición:" / en "Condition:" → the condition text. |
| `rotaciones:24/:34`, `:82-84` | es/en | "Conjunto comparado" / "Compared set" | DEV, DUP | DELETE. It repeats the value and the context. |
| `rotaciones:47-54` | es/en | breadcrumb | DUP | DELETE |

### Comercio page

| file:line | loc | Current text | Cat. | Action |
|---|---|---|---|---|
| `comercio:25/:32` | es/en | "Comercio" / "Trade" | – | KEEP |
| `comercio:26-27/:33` | es/en | "Prepara un anuncio de Pokémon, items, Diamonds o KKs para comercio comunitario." | FILL | REPLACE. es: "Crea y copia anuncios de compra o venta de Pokémon, items, Diamonds y KKs de PokeAlliance." en: "Create and copy PokeAlliance buy or sell listings for Pokémon, items, Diamonds and KKs." |
| `comercio:28-29/:34`, `:52` | es/en | "Prepara los datos de lo que quieres vender o comprar. Los anuncios públicos aún no están habilitados." | INTRO, META | DELETE |
| `comercio:50` | es/en | "Comunidad" / "Community" | KICK | DELETE |
| `comercio:54-56` | both | decorative 64 px ball tile | FILL | DELETE |
| `comercio:40-47` | es/en | breadcrumb | DUP | DELETE (same decision as Guías) |

### TradeDesk (`TD`)

| file:line | loc | Current text | Cat. | Action |
|---|---|---|---|---|
| `TD:339-342` (`:115/:174`, `:101/:159`) | es/en | "Borrador local" plus "Se compone en este navegador; aún no se publica ni guarda." | META, BADGE | DELETE the strip. REPLACE it with one line under the CTA. es: "No se guarda. Copia el anuncio antes de salir." en: "Not saved. Copy the listing before you leave." |
| `TD:673` | es/en | "Borrador local", a second time | DUP, KICK | DELETE |
| `TD:63/:121` | es/en | "Componer anuncio" / "Compose listing" | – | KEEP. It names the form region. |
| `TD:64-71/:122-129` | es/en | Quiero, Vender, Comprar, ¿Qué vas a comerciar?, Diamonds, KKs, Pokémon, Item | – | KEEP |
| `TD:72-73/:130-131` | es/en | Cantidad, Nombre del item | – | KEEP |
| `TD:74/:132`, `:426` | es/en | "Escribe el nombre tal como aparece en el juego. El catálogo aún no está completo." | META | REPLACE. es: "Nombre tal como aparece en el juego." en: "Name as shown in-game." |
| `TD:421` | both | placeholder "Normal charger" | FILL | DELETE. The hint already covers it. |
| `TD:435` | both | placeholder "1,000,000" (KKs) / "1" (others) | – / FILL | KEEP the KK example, which shows the accepted grouping. DELETE the "1". |
| `TD:75/:133` | es/en | "Pokémon o variante" | – | KEEP |
| `TD:76/:134`, `:459` | es/en | "Busca en las 910 variantes del roster" | DEV | REPLACE. es: "Buscar por nombre" en: "Search by name". The 910 is hard-coded and "roster" is internal jargon. |
| `TD:77/:135` | es/en | "Elige un Pokémon de la lista." | – | KEEP, but show it only after interaction (§3). |
| `TD:78/:136`, `:117/:176` | es/en | "Datos del Pokémon" + "Opcional" | – | KEEP. Render "Opcional" as plain muted text, not a badge. |
| `TD:79/:137` | es/en | "Más atributos" | – | KEEP |
| `TD:80` | es | "Training skills" | I18N | REPLACE. es: "Entrenamiento" (the Spanish game client's own word, per `images/2.png`). en: "Training". |
| `TD:81/:139`, `:544` | es/en | "Completa sólo los valores que puedas comprobar en el cliente." | DISC, DEV | DELETE. It is redundant with "Opcional", "cliente" is jargon, and "sólo" is the outdated spelling. |
| `TD:82/:140` | es/en | "Ditto Memory" | – | KEEP (game term) |
| `TD:83/:141` | es/en | "Slots totales" / "Total slots" | – | REPLACE with the in-game label "Memory Slots" in both locales. Update `smoke:136`. |
| `TD:84/:142` | es/en | "Memoria N" / "Memory N" | – | KEEP |
| `TD:85/:143`, `:579` | es/en | "Uno por defecto; hasta seis según la información facilitada por el propietario." | META | DELETE. It talks about the site owner, and the 1–6 select already encodes the rule. |
| `TD:86/:144` | es/en | "Level" | – | KEEP until the owner decides Level vs "Required Level". |
| `TD:88/:146` | es/en | "Star level" | – | REPLACE with "Star Level" (game casing) |
| `TD:90-91/:148-149` | es/en | "Held X" / "Held Y" | – | KEEP until Corte 1. The naming is unverified. |
| `TD:95` | es | "Next boost chance (%)" | I18N | REPLACE. es: "Probabilidad del próximo Boost (%)". en (`:153`): "Next Boost chance (%)". |
| `TD:96/:154`, `:625,:732,:313` | es/en | "Precio pedido" / "Asking price" | WRONG | REPLACE with "Precio" / "Price". The current label is wrong when intent = buy. |
| `TD:97-99/:155-157` | es/en | A convenir, Importe, Moneda | – | KEEP |
| `TD:100/:158` | es/en | "Vista del anuncio" | – | KEEP |
| `TD:102/:160` | es/en | `empty` "Selecciona un activo y completa sus datos…" | dead | DELETE (the key is never referenced) |
| `TD:103-105/:161-163` | es/en | enterQuantity, enterItem, invalidPrice | – | KEEP |
| `TD:106/:164` | es/en | "Revisa los valores de nivel, boost, stars, chance, training o memorias." | I18N | REPLACE for Corte 0. es: "Hay valores no válidos en los datos del Pokémon." en: "Some Pokémon details are invalid." Also mark each field (§3). Per-field messages come in Corte 1. |
| `TD:107/:165`, `:719` | es/en | "Datos declarados para esta unidad" | DISC | DELETE. The person reading it is the seller. |
| `TD:108/:166`, `:712` | es/en | "Cantidad exacta" | DUP | REPLACE with `t.quantity`: "Cantidad:" / "Quantity:" |
| `TD:109/:167`, `:311` | es/en | a separate "Forma corta: 1kk" line in the copied text | DUP | REPLACE by folding it into the title line: "Vender: KKs × 1,000,000 (1kk)". Delete the key. |
| `TD:110/:168`, `:730` | es/en | "Precio NPC: aún no verificado en el catálogo" | META | DELETE. Update `smoke:146`. |
| `TD:111/:169-170`, `:539` | es/en | "Addon, aura, ball y helds: nombres declarados, todavía sin catálogo validado." | META | DELETE |
| `TD:112-113/:171-172` | es/en | "Copiar anuncio", "Anuncio copiado." | – | KEEP |
| `TD:114/:173` | es/en | "No se pudo copiar. Selecciona el texto de la vista previa." | – | REPLACE. es: "No se pudo copiar. Selecciona el texto de abajo y cópialo." en: "Couldn't copy. Select the text below and copy it." |
| `TD:116/:175`, `:765` | es/en | "El RMT se anuncia fuera de los canales oficiales. La transacción es responsabilidad de los jugadores." (always shown) | DISC, DEV | REPLACE, and show it only when the currency is BRL, USD or MXN and the price is not negotiable. es: "No publiques anuncios con dinero real en los canales oficiales de PokeAlliance." en: "Don't post real-money listings in official PokeAlliance channels." |
| `TD:118/:177`, `:612` | es/en | placeholder "Selecciona un Pokémon" | FILL | DELETE. It restates the label, and "Selecciona" is wrong for a text field. |
| `TD:552`, `:563` | both | `aria-label` "`${skill} level`" / "`${skill} progress`" in English | I18N | REPLACE. es: "`${skill}: nivel`" / "`${skill}: progreso (%)`". en: "`${skill}: level`" / "`${skill}: progress (%)`". |
| `TD:550`, `:560` | both | "Lv.", "%" | – | KEEP (game terms) |
| `TD:767` | es/en | textarea `aria-label` = "Vista del anuncio" | DUP | REPLACE. es: "Texto del anuncio" en: "Listing text". |
| `TD:37-46` | both | training skill names in English | – | KEEP. The Spanish game client shows them in English (`images/2.png`). |

---

## 3. Fake or broken controls and dead UI

1. **`TD:676-689`: the preview header sprite is wrong.**
   - For Pokémon it always shows the Ditto image hotlinked by the tile (`assets[pokemon].image`, `TD:186`), even after Bulbasaur is chosen.
   - For the other assets it duplicates the large art at `:690-706`.
   - Fix: delete it, along with `trade.css:918-923`.
2. **`TD:489-498` + `trade.css:886-902`: a static `ball.svg` sits in a bordered slot next to the free-text Ball input.** It looks like a ball picker but never changes. Fix: delete it until the Ball catalog exists.
3. **`TD:404-416`, `:192`, `:256`, `:260-261`: a hard-coded demo image.** The item "slot" shows a hotlinked Fire Stone PNG only when the text is exactly "fire stone". Fix: delete the adornment and `fireStoneImage`.
4. **`TD:184-188`: the Pokémon tile hotlinks `wiki.pokealliance.com/pokemon/132.png`.** It uses Ditto to stand for "Pokémon" and adds an external dependency. Fix: use the local `/trade/sprites/ball.svg`, which is already the fallback, and drop the `onError` swap.
5. **`TD:736-751`: validation appears on first paint.** "Elige un Pokémon de la lista." shows, and is announced through `role="status"`, before the user has typed anything. Fix: show it only after the first change or a copy attempt.
6. **`TD:500-506`, `:527-535`, `:551-569`: invalid fields are not marked.** Level, Boost, Stars, chance and training inputs have no `aria-invalid`, so `invalidDetails` fires without pointing at a field. Fix: set `aria-invalid` on each field and link the message with `aria-describedby`.
7. **`TD:707`: `aria-live="polite"` wraps the whole preview**, which re-announces it on every keystroke. Fix: remove it. Keep `role="status"` only on the feedback at `:761`.
8. **`TD:766-771`: a readonly textarea duplicates the preview**, both visually and for screen readers. Fix: render it only after a copy failure.
9. **`TD:372`: the `trade-asset-${id}` modifier classes are only used by dead CSS** (`trade.css:203-214`). Fix: remove them.
10. **Dead CSS in `trade.css`:**
    - `:196-214` (tile `svg` rules; the tiles now render `<img>`);
    - `:439-453` (`.trade-preview-glyph`, `.trade-glyph-*`);
    - `:455-490` (`.trade-preview-pokemon*`);
    - `:53-54` (`.trade-page-mark` color and font-size for a text glyph that no longer exists);
    - `:2` (`.trade-page { width:100% }` is a no-op).
11. **Dead copy:** `TD:102/:160` (`empty`) and `sistemas:24/:36` (`descriptionLabel`).
12. **Dead DOM:** the eyebrows at `sistemas:65` and `rotaciones:56` are rendered and then hidden by `wref.css:512`.
13. **`guias:141-143`: the MapPin column looks like a map link but is not one.** Fix: delete it. When a map feature exists, replace it with a real "Ver en el mapa" / "View on map" link; `map-features.sample.json` has no Saffron today.
14. **`guias:153`, `:159`: `ArrowUpRightIcon` is the external-link glyph, used on plain text.** Fix: delete it.
15. **`guias:95`, `:18-19`: quest art is hard-coded to one slug** (`quest.canonicalSlug === 'porygon-quest-dr-vektor'`). Fix: derive it from the quest's `pokemon` fact. Also:
    - delete the fallback `:97` ("P");
    - `:98` `<img>` has no `width`/`height`, which causes layout shift.
16. **Bare counts** at `guias:77,:135` and `sistemas:73,:93` have no label.
17. **Empty `<>` fragments** at `sistemas:105,111,117`. Fix: remove them.
18. **Sidebar nav icon: `src/layouts/AppLayout.astro:207-217` renders `ball.svg` at 16 px.**
    - That is a 0.25× scale of 1-unit pixel art, so it looks mushy.
    - It is the only non-Lucide nav icon.
    - Fix: use a Lucide icon.
19. **`comercio:54-56`: a decorative ball tile.** Fix: delete it.

---

## 4. Game-layer candidates

| Priority | Surface | Adopts | Why |
|---|---|---|---|
| **Corte 0 pilot A** | Preview card `TD:670-772` | `UnitTooltip` (card) + `StatRow` + `Section` + `Meter` | It is literally the in-game tooltip (`images/1.png`) and already uses `dt`/`dd`, so no data work is needed and it exercises all four signature primitives. Mapping below the table. |
| **Corte 0 pilot B** | Asset tiles `TD:368-396` | `SpriteSlot` (bevel, recess) inside a shell radio card | This defines the selection grammar: a blue `--cx-blue-hi` ring plus a check icon plus text. It replaces today's gold border, gold tint and glow at `trade.css:822-829`. |
| **Corte 0 pilot C** | Sistemas cards: item `sistemas:77-85`, move `:97-123` | `GameCard` + `StatRow` | This is the first non-Comercio adopter: pure label/value data, one record each, prerendered Astro with no island. It proves the grammar works as plain CSS. Rows: "Elemento:", "Slot:", "Cooldown: 12 s", "Modo: PvE"; items get "Tipo:" plus the description. |
| Later (Corte 2, catalogs/infobox) | Quest `guias:82-126` | Infobox header: Required Level, NPC, Location, time limit; rewards as item rows with `SpriteSlot`s | Needs item sprites and links, and data localization. The steps stay shell prose (`<ol>`). |
| Later (Corte 2 or the map wave) | Location `guias:140-165` | Infobox: Tipo, Región, Teleport command; link to the map | Needs the kind label map and a map feature link. |
| Later (Corte 1) | Price row `TD:731-734` and amounts `:711-715` | `MoneyChip` / `PriceStack` | Tied to the Corte 1 price model (units, KK shorthand). |
| Not game layer | Rotaciones cards, page headers, the composer form | Shell | Editorial rule text and forms belong to the shell voice. |

**Pilot A mapping (preview card, `TD:670-772`)**
- Sprite `TD:690-706`: integer scale only (64 or 128 px), floating on the card with no frame or drop-shadow.
- Title `:709`: Poppins 700, 16 px, centered.
- Rows `:720-727`: gold labels with a trailing colon, right-aligned tabular values, ordered as in the game: Level, Aura, Boost, Nickname, Memory Slots, Star Level, Ball, Helds, Addon.
- Training rows (`:290-304`): an "Entrenamiento: N" `Section` with a compact gold meter per skill ("Attack", "16 (53%)").
- Ditto memory: a "Memory Slots: N" section.
- CTA `:752-759`: the screen's single gold CTA.
- No new functionality.

---

## 5. Migration notes

### 5.1 `guides.css` → tokens and components

| Line(s) | Now | Target |
|---|---|---|
| `:8-12` `.guide-quest` | radius 1rem; bg `oklch(.16 .018 250)` | `GameCard`: `--cx-card`, 1px `--cx-line`, radius 8 |
| `:15-21` `.guide-quest-head` | 15rem purple band `oklch(.26 .06 305)` | DELETE the band (off-palette; hero-like) |
| `:25`, `:124`, `:234` | `clamp()` / rem padding | spacing tokens 16 / 24 |
| `:28-37` `.guide-quest-label` / `-region` | mono, 0.65rem, 700, 0.08em, uppercase, purple `oklch(.81 .09 305)` | DELETE the label. The region becomes a StatRow `dt` (`--cx-gold`, Poppins 600, 13 px, Title Case, colon) |
| `:39-47` quest h3 | `oklch(.98 .01 300)`; `clamp(1.4rem, 2.6vw, 2.3rem)`; weight 750; −0.045em | `--cx-value`, Poppins 700 20 px (card title 16 px), letter-spacing 0 |
| `:49-55` summary | `oklch(.86 .025 300)`, 0.8rem | `--cx-copy-2`, 14 px Inter |
| `:57-76` `.guide-level` | chip: border `oklch(.57 .08 305)`, radius .5rem; span `oklch(.86 .03 300)` 0.65rem; strong `white`, mono, 0.8rem | `StatRow`: `dt` gold 13 px; `dd` `--cx-value`, Inter 500 13 px tabular |
| `:78-94` art box + `::before` ring | `oklch(.32 .09 305)`; 1.5rem ring `oklch(.62 .1 305 / .2)` | DELETE the ring and background. Use a `SpriteSlot` or a floating sprite. |
| `:96-102` art img | `min(90%, 12rem)`; `drop-shadow(0 1rem .9rem …)` | integer scale (96 or 128 px); remove the filter (e0, no glow) |
| `:104-114` `.guide-art-fallback` | mono, 5rem "P" | DELETE |
| `:127-130` `.guide-rewards` | nested panel bg `oklch(.18 .02 250)` | DELETE the box-in-box. Rewards become a list on the card. |
| `:132-138` h4 | `--wiki-copy`, 0.85rem, 700 | Poppins 600 14 px, `--cx-copy` |
| `:155-175` step circles | purple `oklch(.5 .08 305)` / `(.55 .1 305)` / `(.85 .07 305)`; mono 0.64rem; radius 50% | plain `<ol>` decimal, Inter 14 px; or `--cx-line-strong` circles with 12 px tabular numbers |
| `:177-194` step / reward text | `--wiki-copy-secondary`, 0.76rem; `--wiki-line` separators | `--cx-copy-2` 14 px. No internal separators, per tooltip anatomy. |
| `:200-202` `✦` color | `oklch(.75 .1 305)` | DELETE |
| `:208-216` `.guide-location` | radius 0.8rem; `oklch(.16 .018 250)` | `GameCard` (radius 8, `--cx-card`) |
| `:218-230` icon column | 4.5rem green `oklch(.19 .04 165)` / `(.75 .12 165)` | DELETE. DESIGN.md:198 bans colored side stripes. |
| `:237-239` region | `oklch(.72 .08 165)` | `--cx-gold` `dt` |
| `:241-247` location h3 | 1.35rem, 740, −0.03em | Poppins 700 16 px, 0 tracking |
| `:258-274` connections | 0.74rem (11.8 px, under the floor); icon `oklch(.72 .08 165)` | 14 px `--cx-copy-2`; no icon |
| `:276`, `:288` media queries | 800 px / 560 px | consolidated breakpoints (768 / 1280) |
| `:302` | 0.72rem (11.5 px) | 12 px floor |

Totals: 21 oklch literals plus `white`; 14 font-size declarations, of which 8 are below 12 px; 5 radii (1rem, .5rem, 50%×2, .8rem). All go to tokens. The file should shrink to layout only (grid columns, the 768 px breakpoint), roughly 40 lines.

### 5.2 Page utilities and shared classes

**`.eyebrow`** (`wref.css:444`: 11 px uppercase, 0.1em tracking, plus the legacy duplicate at `global.css:339`)
- Used at `sistemas:80,100,106,112,118` and `rotaciones:66,71,76,82`.
- `dt` uses become `StatRow` `dt`. Kicker uses are deleted.
- Retire the class inside this scope.

**`.display-title`** (`wref.css:455`: 1.875rem Verdana 700; duplicate at `global.css:347`)
- Becomes Poppins 700 `clamp(28px, 3vw, 40px)`, tracking 0.
- `comercio:51` bypasses it with `.trade-page-header h1` (`trade.css:27-34`: `clamp(2rem, 3vw, 2.65rem)`, 750, −0.05em). Use the shared header instead.

**`.section-title`** (`wref.css:465`) becomes Poppins 600 20 px.

**`.muted-copy`**: after the intros are removed, it has no use in scope.

**`.wiki-breadcrumbs`** (`wref.css:481-505`)
- If kept anywhere: separators use `--cx-muted` and `aria-hidden`; the current crumb uses `--cx-copy-2` and `aria-current="page"`.

**Header markup is duplicated in 4 pages:** `guias:61-72`, `sistemas:56-68`, `rotaciones:47-59`, `comercio:40-57`. Extract a `PageHeader.astro` in Corte 0.

**Sistemas utilities**

| Where | Now | Target |
|---|---|---|
| `sistemas:78,98` | `wiki-panel wiki-article-panel p-5` (radius 12, `--wiki-surface`) | `GameCard` (radius 8, `--cx-card`) |
| `:81,101` | `text-xl font-semibold tracking-tight` | Poppins 700 16 px, tracking 0 |
| `:103` | `dl grid grid-cols-3 gap-3 text-sm` | `.cx-stats` (2 columns, 13 px / 21 px) |
| `:107,113,119` | `dd` `mt-2 font-semibold` | Inter 500 13 px, tabular, right-aligned |
| `:83` | `muted-copy mt-4` | 14 px `--cx-copy-2` |

**Rotaciones utilities**

| Where | Now | Target |
|---|---|---|
| `rotaciones:64` | `wiki-panel … p-5 sm:p-6` | shell panel (radius 12, `--cx-surface`) |
| `:67` | `text-2xl font-semibold tracking-tight` | 20 px, 600, tracking 0 |
| `:72` | `text-lg leading-8 text-foreground/90` (18 px, off-scale) | 16 px `--cx-copy` |
| `:77,:83` | `text-sm leading-6 text-foreground/80` | a `dl`: 14 px `--cx-copy-2` values; labels use shell labels, not gold |

**Counts** (`guias:77,135`, `sistemas:73,93`): `font-mono text-xs text-muted-foreground`. Delete them; mono is reserved for IDs.

### 5.3 `trade.css`: two skins, with keep, delete and map instructions

**A. Delete now: dead, or tied to UI that §2/§3 remove**

| Line(s) | What |
|---|---|
| `:1-3` | `.trade-page` no-op |
| `:5-55` | page header, kicker, h1, intro, mark |
| `:57-77` | status strip |
| `:196-214` | tile `svg` rules |
| `:426-433` | preview kicker |
| `:439-490` | glyph rules and `.trade-preview-pokemon*` |
| `:547-551` | "declared" caption |
| `:578-587` | `.trade-preview-note` part |
| `:670-677` | mark, header and status entries in the 560 px media query |
| `:704-711` | the `--trade-*` tokens; replace with `--cx-*` |
| `:713-760` | skin-2 header, kicker, h1, intro, mark and status. Keep only the `.trade-preview-intent` selector from `:722` and restyle it. |
| `:886-902` | input sprite adornments |
| `:918-923` | header sprite |

**B. Skin-1 declarations that skin 2 already overrides (dead today)**
- `.trade-composer` / `.trade-preview`: `:89` (color part), `:90-91`
- `.trade-section-heading h2` / `.trade-preview-heading h2`: `:101`
- field labels: `:119`
- `.trade-switch`: `:127-129`; pressed state `:149-150`
- asset picker gap: `:156`
- `.trade-asset-option`: `:162-173`, `:175-178`; hover `:182`; pressed `:191-193`
- borders: `:221`, `:326`, `:388`, `:518`, `:543`
- inputs: `:236-238`, `:240`; hover `:250`; focus `:255-256`
- hint color: `:272`
- headings: `:309`
- summary: `:331`
- training inputs: `:370-374`
- preview header: `:422`, `:427`
- preview texts: `:497`, `:507`, `:524`, `:530`, `:536`, `:549`, `:568`, `:574`, `:581`
- copy button: `:601-604`; hover `:614`; disabled `:618-619`
- textarea: `:638-640`, `:642`
- focus outline color: `:655`
- 560 px tile height: `:683`

**C. What survives: layout only, rewritten on `--cx-*` tokens (about 90–120 lines)**
- `.trade-workspace` (`:79-84`)
- composer padding (`:94-96`)
- sticky preview (`:412-416`): `top: calc(var(--wiki-topbar-height) + 16px)` instead of 5rem
- `.trade-asset-picker` grid (`:153-157`)
- field and asset blocks (`:216-223`, `:225-228`, `:319-323`, `:406-410`)
- training and memory lists (`:345-364`)
- `:379-382`, `:384-390`
- media queries (`:659-667`, `:679-690`)

Everything else moves to shared primitives:
- **Controls:** `ui/input`, plus new `Select`, `Checkbox` and `ToggleGroup`/`RadioGroup`. This removes `:124-151`, `:230-297`, `:366-377` and `:392-404`.
- **Preview:** the design-system `.cx-unit` / `.cx-stats` / `.cx-section` / `.cx-meter` classes. This removes `:492-576`, `:925-964` and the keyframes `:992-1001`.
- **CTA:** a new gold `Button` variant. This removes `:596-621` and `:966-981`.

**D. Value map for the live hex and oklch values**

| Current value(s) | Target |
|---|---|
| `--trade-panel #252a2e` | composer: `--cx-surface`, radius 12. Preview: `--cx-card`, radius 8. |
| `--trade-recess #1b2024` | `--cx-recess` |
| `--trade-line #3b4246` | `--cx-line` for layout |
| input and control borders `#4d5455` (`:869,:896`) | `--cx-line-strong` (3.47:1 on recess) |
| hover `#7e8582` (`:877`) | `--cx-muted` |
| `--trade-gold #f3cc62` | `--cx-gold`, only for preview `dt` (`:776`) and the CTA. **Form labels must NOT be gold:** `:774-777` field labels and `:908-910` training names become shell `--cx-copy-2`, Inter 13 px. |
| `--trade-copy #f3f3ee` | `--cx-value` (preview) / `--cx-copy` (form) |
| `--trade-muted #afb7b8` | `--cx-copy-2` (hints) / `--cx-muted` (meta) |
| Preview intent `:947` (gold uppercase) | 12 px `--cx-copy-2` shell meta |
| KK compact `:948` (gold) and `:537` (mono) | `--cx-copy-2`, Inter tabular (critique #9: KK must not read as a game label) |
| Switch selected `#5d563d` / `#fff9e8` (`:787-788`) | `--cx-raised` + `--cx-value` + 2 px `--cx-blue-hi` ring |
| Tile `#454a48`, `#2c3234`, `#e7e9e5` (`:802-806`) | `--cx-line-strong`, `--cx-card`, `--cx-copy` |
| Tile inset `#ffffff0c` (`:809`) | delete |
| Tile hover `#9d916e`, `#373c3b` plus translate and scale (`:817-819`, `:850-853`) | `--cx-raised` + e1 shadow `0 6px 16px rgb(0 0 0/.28)`; no translate |
| Tile selected `#e7bb57`, `#403b2d`, `#fff5d7`, glow `#e7bb5736`, `#00000024` (`:823-828`) | `--cx-blue-hi` ring + check icon + text; no glow |
| Art box `#1c2225`, `#ffffff12` (`:837-838`) | `SpriteSlot` (`--cx-recess`, 1 px `--cx-line-strong`, bevel with 4 px fallback) |
| `drop-shadow` `#00000070` / `#00000083` (`:846`, `:938`) | delete |
| Focus `#e7c25d4d` (`:883`, 30 % alpha, **2.04:1**) and gold outlines `:989`, `:655` | 2 px solid `--cx-blue-hi` (8.71:1) |
| Summary `#e5e7e2` (`:905`) | `--cx-copy` |
| Preview header band `#303638`, `#4b514f` (`:914-915`) | delete the band |
| Art background `#202627` (`:930`) | `--cx-card`; the sprite floats |
| CTA `#e3bd5b`, `#f2d47b`, `#27251d` (`:967-974`) | `--cx-gold` / `--cx-gold-ink` (11.02:1). Hover `color-mix(in oklab, var(--cx-gold) 88%, white)`. This needs a token; none is approved yet. |
| Disabled `#4e5554`, `#383e3e`, `#aab1ae` (`:978-980`) | `--cx-line` / `--cx-raised` / `--cx-muted` |
| Errors `oklch(.68 .15 25)` `:261`, `(.78 .13 25)` `:278`, `(.81 .13 47)` `:591` | `--cx-danger` |
| Success `oklch(.78 .12 150)` `:625` | `--cx-success` |
| Checkbox accent `oklch(.74 .11 72)` `:403` | `--cx-blue` (or the Checkbox primitive) |
| Placeholder `--wiki-copy-quinary` `:265` (2.80:1) | `--cx-muted` |

**E. Type, radius and motion**

- **Font sizes (32 declarations, 0.6–0.82rem):**
  - labels `:120` → 13 px
  - inputs `:242`, `:375` → 14 px, and **16 px at ≤768 px** (iOS focus zoom)
  - hints `:273` → 12 px
  - tiles `:807` → 13 px
  - switch `:140`, checkbox `:398` → 14 px
  - h2 `:102` → Poppins 600 16 px
  - subheads `:310` → Poppins 600 14 px
  - summary `:332` → Poppins 600 13 px
  - training `:357` → 13 px
  - preview title `:508` → Poppins 700 16 px, centered
  - `dt`/`dd` `:525`, `:531`, `:563` → 13 px / 21 px
  - note, rule, validation, feedback `:582`, `:592`, `:626` → 12 px
  - CTA `:605` → 14 px Inter 600
  - textarea `:644` → 13 px Inter (not mono)
- **Weights and tracking:** weights 650–760 become 600/700 (Poppins is static). Tracking `:32`, `:104`, `:510` and uppercase `:23`, `:431`, `:500` go to 0 and none.
- **Radii (21 values):** controls 6, preview 8, composer 12, slots bevel.
- **Motion:**
  - 180 ms (`:143`, `:175`, `:608`, `:810`, `:847`) → d2 140 ms
  - 120 ms press (`:178`, `:610`) → d1 90 ms
  - 160 ms (`:244`) → d2
  - the keyframe at 280 ms (`:939`) → d4 260 ms
  - exits use `cubic-bezier(.4,0,1,1)` at 0.7×
- **Breakpoints** 980 / 560 → 768 / 1280.
- **Sprites:** use 64 or 128 px only, because the SVGs have 1-unit granularity. Today they render at:
  - `:842` 57.6 px
  - `:1012` 46.4 px
  - `:893` 40 px
  - `:934` 152 px
  - `:943` 176 px
  - `:919` 43.2 px
  - `:751` 56 px

### 5.4 Comercio: minimal Corte 0 plan (keeps it coherent until Corte 1)

1. **Page chrome:** replace `comercio:48-57` with the shared `PageHeader` (h1 only) and delete kicker, intro and mark.
2. **Copy:** apply every §2 `TD` row. Delete the status strip, preview kicker, `declared`, `noNpc`, `noCatalog`, `memoryHint` and `trainingHint`. Add the single "No se guarda…" line under the CTA.
3. **Remove the fake affordances:** §3 items 1–4 (header sprite, ball and item adornments, Fire Stone, Ditto hotlink).
4. **Re-skin:**
   - The form becomes shell: Inter, labels `--cx-copy-2`, focus `--cx-blue-hi`, blue selection ring on tiles and the switch.
   - The preview becomes pilot A (`UnitTooltip` with StatRows and the "Entrenamiento: N" meters).
   - "Copiar anuncio" becomes the single gold CTA.
5. **Behavior-neutral a11y fixes:**
   - Show validation only after interaction.
   - Put `aria-invalid` on every validated field, and move hints out of `<label>` into `aria-describedby`.
   - Remove the preview `aria-live`.
   - Render the textarea only on copy failure.
   - Localize the `aria-label`s.
   - Make targets 40 px tall.
   - Show the RMT notice only for fiat prices.
6. **Semantics:** if Corte 0 ships `RadioGroup`/`ToggleGroup`, move Sell/Buy and the asset tiles to it (`TD:352-363`, `:368-396`). Then update `smoke:128,133,142` from `button` to `radio`.
7. **Tests to update:**
   - `smoke:136`: "Slots totales" becomes "Memory Slots".
   - `smoke:146`: remove the `noNpc` assertion.
   - `smoke:117-126`: still 4 tile images, now all local.
8. **Defer to Corte 1:**
   - replace the datalist with a combobox;
   - catalogs (Ball, Held, Addon, Aura, Item);
   - schema and draft persistence;
   - Level vs Required Level;
   - Held naming;
   - next boost chance;
   - currencies and KK shorthand;
   - Held Items section with slots;
   - per-field error messages.

---

## 6. i18n parity and accessibility

**i18n**

1. **The `es` pages render English data** with no `lang="en"` (WCAG 3.1.2):
   - quest summary, steps and rewards (`guias:87,109,120`);
   - access and travel text (`:154`, `:160`);
   - item description (`sistemas:83`);
   - rotation value and context (`rotaciones:72,78`).

   Wrap these in `lang="en"`, and plan localized fact values in the data layer, not in the UI.
2. **Raw enums and English fallbacks appear in both locales:** `guias:146` ('city', 'location'), `sistemas:80,100` ('training_charger', 'item', 'PVE', 'move') and `rotaciones:66` ('availability_scope', 'assertion'). They need locale label maps.
3. **`formatFactValue` (`repo.ts:78-86`)** dumps `key: value` pairs and returns hard-coded 'Yes'/'No' for booleans. It is shared with `buscar` and `pokedex/[slug]`. Add locale-aware per-fact formatters (cooldown, travel connection, context) instead of editing the shared function blindly.
4. **"Quest" is English in `es`** (`guias:85`).
5. **TradeDesk strings:**
   - English in `es`: `TD:80` "Training skills", `:95` "Next boost chance (%)", aria-labels `:552,:563`.
   - `:106` mixes Spanish with lowercase English terms.
   - `:81` uses the outdated spelling "sólo".
   - Game-label casing: "Star Level" (`:88/:146`) and "Memory Slots" (`:83/:141`) should follow the client.
6. **Naming mismatch:** nav "Rotaciones" vs h1 "Rotaciones y tiers" (`src/i18n/config.ts:40,60` vs `rotaciones:17,27`).
7. **Casing rule for game-layer labels:**
   - `es` uses sentence case with a colon ("Nivel requerido:");
   - `en` uses Title Case with a colon;
   - in-game terms keep the client's wording in both locales ("Memory Slots", "Required Level", "Held Items").
8. **Cross-scope issue that affects all 4 routes:** the language switch and `hreflang` point to the locale root (`src/layouts/AppLayout.astro:97-98,130-139`), so switching language on `/es/comercio/` drops the page.
9. **Grouping is intentional:** `formatWhole` uses `en-US` grouping on `es` (`src/lib/trade/draft.ts:16-18`), as the plan requires. KEEP.

**Accessibility**

1. **Breadcrumbs:**
   - The current crumb uses `--wiki-copy-quinary` `#61656c` on the canvas: **3.30:1** at 12 px (fails AA).
   - The "/" separators are not `aria-hidden` (`guias:66`, `sistemas:61`, `rotaciones:52`, `comercio:45`).
   - There is no `aria-current` or list semantics.
2. **Duplicate numbering:** "01" spans inside the `<ol>` (`guias:108`) are read twice.
3. **Missing label/value semantics:** Rotaciones and Guías use `<p>`/`<span>` pairs (`rotaciones:71-84`, `guias:89-92`). Use `<dl>`.
4. **Unlabelled counts:** `guias:77,135` and `sistemas:73,93` read as a bare "1".
5. **Single-choice groups use `aria-pressed`** (`TD:355,371`). They should be radio groups (critique §9.7.5).
6. **Hints inside `<label>`** (`TD:426`, `:439-443`, `:469-471`) bloat the accessible name. Use `aria-describedby`.
7. **Missing `aria-invalid`** on Level, Boost, Stars, chance and training fields (`TD:500-506`, `:527-535`, `:551-569`).
8. **Whole-preview live region** (`TD:707`); validation announced on load (`TD:736-751`).
9. **Focus:** input focus outline is 30 % alpha gold, **2.04:1** (`trade.css:256,883`). Placeholder text is **2.80:1** (`:265`).
10. **Targets under 40 px:** switch buttons 32 px (`trade.css:134`), training inputs 32 px (`:369`), the `<details>` summaries (text height only, `:330-335`) and the native checkbox (`:392-404`).
11. **Input text is 12 px** (`trade.css:242`), which triggers iOS focus zoom. Many texts are under the 12 px floor: `trade.css` `:21,429,498,525,550,582,644` and `guides.css` `:33,69,174,264,302`.
12. **Images without dimensions** (layout shift): `guias:98`, `TD:692`.
13. **Duplicate announcement:** the readonly textarea (`TD:766-771`) repeats the preview for screen readers.

---

## 7. Top 10 fixes, ranked

1. **Remove Comercio's meta and status text.** Delete `comercio:28-29/:34,50,54-56`, `TD:339-342,673,719,730,539,544,579`, `previewHint`, and the second `itemNote` sentence. Add one "No se guarda…" line under the CTA. This is the densest block of slop. Update `smoke:146`.
2. **Collapse the two skins in `trade.css`.**
   - Delete the dead code (§3 item 10), the overridden skin-1 declarations (§5.3 B) and the removed-UI blocks (§5.3 A).
   - Form labels leave gold. Gold remains only on preview `dt`s and the single CTA.
   - Selection uses the blue ring, focus uses `--cx-blue-hi`, and controls move to the `ui/*` primitives.
3. **Preview becomes the `UnitTooltip` (pilot A).**
   - This also fixes the wrong Ditto header sprite (`TD:676-689`), the always-on `aria-live` (`:707`), the duplicate textarea (`:766-771`) and the premature validation (`:736-751`).
4. **Stop dumping raw data.** Add locale-aware formatters and label maps for:
   - `sistemas:119` ("amount: 12 · unit: second");
   - `rotaciones:78` ("excludedScopes: …");
   - `guias:160` ("mode: Teleport · command: …");
   - the enum kickers at `sistemas:80,100`, `rotaciones:66` and `guias:146`.
5. **Delete dev eyebrows, intros, count badges and the "Quest" kicker.**
   - "Wiki Core / …": `sistemas:20,32,65`, `rotaciones:19,29,56`.
   - Intros: `guias:25,36,71`, `sistemas:21,33,67`, `rotaciones:20-21,30-31,58`.
   - Counts: `guias:77,135`, `sistemas:73,93`.
   - "Quest": `guias:85`.
   - Also extract a shared `PageHeader` and drop the two-level breadcrumbs.
6. **Sistemas cards adopt `GameCard` + `StatRow` (pilot C).** This is the first prerendered, content-page proof of the game layer.
7. **Strip Guías visual slop.** In `guides.css`:
   - purple hero band `:15-21`;
   - ring `:87-94`;
   - drop-shadow `:101`;
   - "P" fallback `:104-114`;
   - green side column `:218-230`;
   - out-of-place external-link arrows.

   In `guias`:
   - the "✦" bullets at `:119`;
   - fix the "Ruta de viaje" label (`:149`);
   - replace the hard-coded Porygon slug (`:95`).
8. **Fix i18n in TradeDesk:**
   - "Entrenamiento" (`:80`);
   - the translated chance label (`:95`);
   - localized aria-labels (`:552,:563`);
   - "Star Level" / "Memory Slots";
   - a neutral price label that works for Buy (`:96/:154`);
   - an fiat-only RMT notice (`:765`).
9. **Complete the a11y pass:**
   - radio groups (update `smoke:128,133,142`);
   - `aria-invalid` and `aria-describedby` on every validated field;
   - 40 px targets;
   - 16 px mobile inputs;
   - breadcrumb contrast (3.30:1) and hidden separators;
   - `lang="en"` on English data.
10. **Remove hotlinks and fake affordances:**
    - Ditto tile (`TD:186`);
    - Fire Stone special case (`:192,256-262,404-416`);
    - static ball slot (`:489-498`);
    - Guías MapPin tile (`guias:141-143`);
    - the 16 px pixel-art `ball.svg` in the sidebar (`src/layouts/AppLayout.astro:207-217`), replaced by a Lucide icon;
    - render the remaining editorial sprites at 64 or 128 px only.