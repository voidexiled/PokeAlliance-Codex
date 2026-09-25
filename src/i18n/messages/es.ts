import { GUILD_EMPTY } from './guild-empty.ts';
import type { MessageTree } from './types';

// Source dictionary of the site (spec §13.2). `en.ts` mirrors it key by key.
//
// These are the namespaces of §13.2, in its order. Each one is filled by the
// milestone that builds its surface — `shell` and `ui` with the frame, the page
// namespaces with their pages — because `pnpm i18n:check` fails on a key that
// no file under src/ reads. Keys are camelCase in English; the names of the
// elements are not here, they come from `content/elementos.json` (§8.0.5).
export const es = {
  // Shared namespace of the components (DP1): the text a design-system
  // component needs is a prop, and whoever composes it reads it from here —
  // also in `es`, so the component's own Spanish default is never what ships.
  // The `es` values are the defaults of the design system and the `en` ones
  // are what each of its READMEs gives for the en locale (C-R3).
  //
  // A leaf lands with the first page that composes its component, because
  // `pnpm i18n:check` fails on a key nothing under src/ reads. The label of
  // `SortSelect` and the placeholders of `RangeField` landed with Comercio (M12),
  // the «Inactivo» of `DataTable` with Guild (M13).
  ui: {
    // Game tooltip (§7.5, DS:guias/10). `pinHint` is the strip of every popover
    // panel, with the name the table of §13.2 gives it. `or` joins two price
    // options, inside a panel and in `PriceOptions` alike (§13.3). `shiny` is
    // the accessible name of the Shiny mark on panels, slots, cards and chips,
    // a game term written as in the client (§13.4). `sheet` is the accessible
    // name of the static sheet of a detail page, `GameTooltip variant="sheet"`
    // (§7.5.9): the Pokémon page (§8.3) and the listing detail (§9.6).
    pinHint: 'Mantén Shift para fijar',
    or: 'o',
    shiny: 'Shiny',
    sheet: 'Ficha de {name}',
    // Row labels of the tooltip builders of §7.5.3, without the colon that
    // `GameTooltip` adds. Whoever composes a page passes the whole object to
    // `pokemonTip`, `itemTip`… as their `TipLabels`. `level` is the value of
    // the `requirement` row (§13.3); `diamonds` and `pokedolares` are the
    // titles of the two currency panels. Tier, Stone, Fragment and Diamonds are
    // game terms (§13.4). The same object is the `labels` of `LootCard`, whose
    // keys are Drop de, Elemento, Uso, Cantidad, Precio NPC and Precio de
    // tienda (DS:LootCard, §8.3); `quantity` is also a key of the listing
    // family (§9.5.8).
    tooltip: {
      requirement: 'Requisito',
      level: 'Nivel {n}',
      tier: 'Tier',
      elements: 'Elementos',
      generation: 'Generación',
      role: 'Rol',
      stone: 'Stone',
      fragment: 'Fragment',
      category: 'Categoría',
      droppedBy: 'Drop de',
      element: 'Elemento',
      use: 'Uso',
      quantity: 'Cantidad',
      npcPrice: 'Precio NPC',
      shopPrice: 'Precio de tienda',
      system: 'Sistema',
      boughtAt: 'Se compran en',
      usedFor: 'Se usan en',
      diamonds: 'Diamonds',
      pokedolares: 'Pokédólares',
    },
    // `ViewToggle`: the name of the group and one label per view, picked by
    // the view id (declared in `src/i18n/dynamic-keys.ts`).
    views: {
      label: 'Vista',
      cards: 'Cards',
      slots: 'Slots',
      list: 'Lista',
    },
    // FilterToolbar and its menus (`src/components/filters/`, Corte 0's Direction C — the
    // owner's chosen direction, spec 16.2.1/16.4.2): one calm row of 40 px buttons
    // (`FilterMenuButton`, whose own name is `pokedex.filters.*`; this namespace only the text
    // every menu shares), each opening a dark `FilterMenuPanel` of slots (`ElementGridMenu` for
    // Tipo/Tipo de moveset, `TierLadderMenu` for Tier, `SegmentMenu` for Variante/Generación);
    // under the toolbar `ActiveFilterTokens` shows the chosen values as removable tokens, and
    // at 768 px and under `MobileFilterSheet` opens a button's own panel as a bottom sheet.
    filterBar: {
      label: 'Filtros',
      // `FilterMenuPanel`: «Limpiar», top-right, drawn only while its own group has a value.
      clear: 'Limpiar',
      // `SegmentMenu` (Variante, Generación): the leading option that clears the group.
      all: 'Todas',
      // `TierLadderMenu`, and the Tier value's own tooltip in Cards and Lista (dotted
      // underline): the label before the value, «Max brokes: —» until content/tiers.json's
      // `maxBrokes` has a number for that tier (the dash is `UNKNOWN`, not part of this key).
      maxBrokes: 'Max brokes',
      // `ElementGridMenu` (Tipo, Tipo de moveset): the counter drawn over the grid, «2 de 2».
      countOfMax: '{count} de {max}',
      // `ElementGridMenu` (Tipo — AND, capped at 2): the rule line under its counter.
      typeRuleHint: 'Hasta {max}; debe tener ambos.',
      // `ElementGridMenu` (Tipo de moveset — OR, no cap): the rule line under its counter.
      movesetRuleHint: 'Ataques en área; basta con uno.',
      // A slot of `ElementGridMenu` dimmed by Tipo's cap (`aria-disabled`): its own tooltip line.
      maxHint: 'Máx. {max}: quita uno.',
      // `ActiveFilterTokens`: the joining word inside one token's sentence («Tipo Volador y
      // Psíquico» for an AND group, «Tipo de moveset Psíquico o Agua» for an OR one) and the
      // accessible name of the token's own remove button.
      and: 'y',
      or: 'o',
      removeToken: 'Quitar filtro: {label}',
      // `PerPageSelect`'s inline label; its options are plain numbers with no text of their own
      // (Slots 48/96/144, Cards 12/24/48, Lista 25/50/100, per view, `src/lib/lists/state.ts`).
      perPage: 'Por página',
      // `MobileFilterSheet`: the close control of the bottom sheet a filter button opens.
      closeLabel: 'Cerrar filtros',
      // `TierLadderMenu`: the rule line of the Tier menu.
      tierRuleHint: 'De mejor a peor.',
      // `MobileFilterSheet`: the footer button of the phone sheet, with the list's own count.
      show: 'Ver {count}',
      // `ActiveFilterTokens`: the name of the token row and its last control.
      active: 'Filtros activos',
      clearAll: 'Limpiar filtros',
      // `FilterMenuButton`: the accessible text of a button's count.
      chosen: '{n} elegidos',
    },
    // `Pagination`: the name of its `nav`, the two ends and the prefix of the
    // accessible name of each page number («Página 2»).
    pagination: 'Paginación',
    prev: 'Anterior',
    next: 'Siguiente',
    page: 'Página',
    // `SortSelect`: its inline label (DS:SortSelect). `RangeField`: the examples of its two
    // fields (DS:RangeField); its legend and hidden labels belong to each filter.
    sortBy: 'Ordenar por',
    rangeMin: 'Mín',
    rangeMax: 'Máx',
    // The list controller of §7.7: the `EmptyState` of a list whose `datos.json`
    // did not load, shown only when a page, a filter or a view needs it (PR5).
    dataError: 'No se pudieron cargar los datos.',
    // Money and trade components of §7.2.5 (`src/components/money/`). Whoever
    // composes one passes this whole object as its `labels`, the way the tooltip
    // builders take `ui.tooltip`. `Rating` reads the two hidden phrases around
    // the score («4.6 de 5 (23 reseñas de operaciones)»), `ChipRow` the name of
    // its «+N», `HeldStrip` the line over the held items, and `TrainingMeter`
    // its row label and the name of its meter. «Held Items» is a game term
    // (§13.4); the amounts themselves need no text here, their currency word is
    // written by `formatPokedolaresLabel` and `formatDiamonds` (§13.3).
    money: {
      outOf: 'de 5',
      tradeReviews: { one: 'reseña de operaciones', other: 'reseñas de operaciones' },
      moreChannels: { one: '{n} canal más: {names}', other: '{n} canales más: {names}' },
      heldItems: 'Held Items: {n}',
      training: 'Entrenamiento',
      trainingProgress: '{stat}, progreso al nivel {level}',
    },
    // Cards of §7.6 (`src/components/cards/`): the texts of `DexCard` that
    // `ui.tooltip` does not carry. `number` and the two generations fill the
    // meta line («Nº 6 · Generación 1», «Gen. 1» in the compact anatomy);
    // `variant` and `normal` are the Variante fact; `drops` names the drop zone
    // and its list; `moreDrops` is the accessible name of a «+N» of drops.
    cards: {
      number: 'Nº {n}',
      generation: 'Generación {n}',
      generationShort: 'Gen. {n}',
      variant: 'Variante',
      normal: 'Normal',
      drops: 'Drops',
      moreDrops: { one: '{n} drop más: {names}', other: '{n} drops más: {names}' },
    },
    // `NumberField`: accessible names of the two steppers, `{label}` being the
    // field's own label («Disminuir Boost mínimo»).
    decrease: 'Disminuir {label}',
    increase: 'Aumentar {label}',
    // `Dialog`: its close button, whose label is required (§7.2.8).
    close: 'Cerrar',
    // `Notice`: its close button.
    dismiss: 'Cerrar aviso',
    // `DataTable`: the chip of an inactive row (Guild members, §10.9).
    inactive: 'Inactivo',
    // `Note`: the bold lead, colon included.
    noteLead: 'Observación:',
  },
  // Frame of §5 and §7.10: skip link, header, sidebar, mobile sheet, rail and
  // footer. The accessible name of the language button is composed by the
  // component as «{languageLabel}: {languageName}». `languageName` is the name of
  // this dictionary's language in itself: the language menu shows each option with
  // the one of its own dictionary, the same on every page (§13.1).
  shell: {
    skipToContent: 'Saltar al contenido',
    navLabel: 'Principal',
    searchHeader: 'Buscar...',
    searchHome: 'Busca Pokémon, ítems, sistemas…',
    searchIcon: 'Buscar',
    shortcut: 'Ctrl + K',
    languageLabel: 'Idioma',
    languageName: 'Español',
    menuOpen: 'Abrir menú',
    menu: 'Menú',
    menuClose: 'Cerrar menú',
    breadcrumb: 'Migas de pan',
    toc: 'Resumen',
    tocLabel: 'En esta página',
    footer:
      'PokeAlliance Wiki es un proyecto comunitario independiente, no afiliado a PokeAlliance.',
    // The account entry of the header (§9.16.1) and its menu (§9.16.2), only in a build with the
    // public Supabase settings. Without a session: `signIn` to `/{l}/cuenta/` (below 768 an icon
    // button with the trainer sprite and the same label). With one: the chip, named `label`
    // (`{user}` the username), whose «!» mark is named `incomplete` while registration steps 2 or
    // 3 are missing (§9.15.1), and then `completeRegistration` is the first item of the menu. The
    // status dot and the «Estado» radios read `trade.presence`. The Comercio links (`myListings`,
    // `myDeals`, `createListing`, `moderation`) exist only with COMERCIO_PUBLICO, and
    // `moderation` only for moderators.
    account: {
      signIn: 'Iniciar sesión',
      label: 'Cuenta de {user}',
      incomplete: 'Registro sin terminar',
      completeRegistration: 'Completar registro',
      myProfile: 'Mi perfil',
      myListings: 'Mis anuncios',
      myDeals: 'Mis operaciones',
      createListing: 'Crear anuncio',
      myGuilds: 'Mis guilds',
      settings: 'Ajustes de la cuenta',
      moderation: 'Moderación',
      signOut: 'Cerrar sesión',
      // The menu head: `mainCharacter` names the «{jugador} · {mundo}» line for assistive tech and
      // `moreCharacters` links to /cuenta/#personajes when the account has more than one.
      mainCharacter: 'Personaje principal',
      moreCharacters: { one: '+{n} personaje', other: '+{n} personajes' },
    },
  },
  // Inicio (§8.1, template A). `documentTitle` is the whole `<title>` of the page
  // (S-01) and `description` its `<meta name="description">` (§13.5).
  //
  // `HomeIntro` (step 1): the h1 `title` and the line `intro`. `{n}` is the
  // number of variants of `content/pokemon.json`, formatted with `formatInteger`;
  // `{list}` names, in the order of `collections`, each collection whose registry
  // has at least one published record, joined with «, » and with `and` before the
  // last one: «ítems, sistemas y actividades» (X12, Q13). With no such collection
  // the line is `introBare`.
  //
  // `featured` is the h2 of `FeaturedSection` (step 3), which Buscar and the 404
  // repeat (§8.6, §8.12). The bento (step 4): the title of each `IndexPanel`
  // (`panels`) and the words a screen reader hears after the figure of its count
  // — `pageCount` on the panels of pages, `elementCount` on the Pokédex one —,
  // each with the leading space that `DS:IndexPanel` puts between the figure and
  // the word; and the hidden h2 and the only column of `WorldsTable` (X3). The
  // links of the panels and the rows of the table come from the registries:
  // system titles, the `nombre` of the Market categories, the activities, the
  // element names (§8.0.5) and the worlds of `content/mundos.json`.
  home: {
    documentTitle: 'PokeAlliance Wiki · Pokédex, tier list e ítems',
    description:
      'Wiki comunitaria de PokeAlliance: Pokédex, sistemas, ítems, actividades, comercio y herramientas de guild.',
    title: 'Bienvenido a PokeAlliance Wiki',
    intro: '{n} variantes de Pokémon, {list} de PokeAlliance.',
    introBare: '{n} variantes de Pokémon de PokeAlliance.',
    collections: {
      items: 'ítems',
      systems: 'sistemas',
      activities: 'actividades',
    },
    and: 'y',
    featured: 'Destacados',
    panels: {
      systems: 'Sistemas',
      items: 'Ítems',
      activities: 'Actividades',
      pokedex: 'Pokédex',
    },
    pageCount: { one: ' página', other: ' páginas' },
    elementCount: { one: ' elemento', other: ' elementos' },
    worlds: 'Mundos',
    world: 'Mundo',
  },
  // Ctrl + K palette (§7.9) and results page (§8.6). `label` is the accessible
  // name of `dialog#buscar-dialogo` (§7.9.2); `groups` are the labels of the
  // `SearchKind` table of §8.6, read with computed access and declared in
  // `src/i18n/dynamic-keys.ts`. The placeholder of the field is not here: it is
  // `shell.searchHeader`, the same string the header trigger shows.
  search: {
    label: 'Buscar',
    results: 'Resultados',
    groups: {
      pokemon: 'Pokémon',
      sistema: 'Sistemas',
      item: 'Ítems',
      actividad: 'Actividades',
      pagina: 'Páginas',
    },
    empty: 'Sin resultados para «{q}».',
    error: 'No se pudo cargar la búsqueda.',
    seeAll: 'Ver todos los resultados de «{q}»',
    // The page `/{l}/buscar/` (§8.6): its h1 (B-01), which also names its search
    // field and its `<title>`; the description of §13.5; and the count of the
    // results bar, shown only with a query (B-08). The field's placeholder is
    // `shell.searchHome`, the string of the Inicio trigger (B-06); the empty and
    // error lines are `empty` and `error` above, and the groups `groups`.
    title: 'Buscar',
    description:
      'Resultados de búsqueda de la wiki de PokeAlliance: Pokémon, ítems, sistemas y páginas.',
    count: { one: '{n} resultado', other: '{n} resultados' },
  },
  // `EntityPicker`, `EntitySlot` and `TierBadge` (§16.1, §16.3.1, §16.3.2, §16.3.6): the same
  // texts everywhere a game entity is chosen (Pokémon, ball, held, aura, addon, Mega Stone or
  // ítem). `choose` is the empty trigger, `{entity}` the entity's own name («Pokémon», «Ball»…);
  // `chosenCount` is the tray count; `none`/`noneFeminine` is the first slot of an optional
  // single choice («Ninguno») or of an inline `AuraPicker`/`AddonPicker` («Ninguna»); `remove` is
  // the «×» of the trigger and of a tray slot; `filters` are the chips shared by `PokemonPicker`
  // and the Pokédex (§16.4.2).
  picker: {
    choose: 'Elegir {entity}',
    chosen: 'Elegido: {entity}',
    chosenCount: { one: '{n} elegida', other: '{n} elegidas' },
    done: 'Listo',
    none: 'Ninguno',
    remove: 'Quitar',
    removeItem: 'Quitar {name}',
    search: 'Buscar',
    resultsCount: { one: '{n} resultado', other: '{n} resultados' },
    noMatches: 'No hay coincidencias.',
    // `EntityPickerPanel`: the choose button of the docked detail pane and the keyboard line.
    pick: 'Elegir',
    keysHint: 'Enter elige · Esc cierra',
    clearFilters: 'Limpiar filtros',
    filters: {
      tier: 'Tier',
      type: 'Tipo',
      allTypes: 'Todos',
      movesetType: 'Tipo de moveset',
      variant: 'Variante',
      generation: 'Generación',
      slot: 'Ranura',
    },
  },
  // Pokédex (§8.2): the description of the page (§13.5, `{n}` the variants of
  // the registry), the count of the results bar by Variante, the empty state
  // with its one action, and the captions and fixed column headers of the
  // Lista view. «Shiny» is a game term (§13.4).
  //
  // The rest of the list's text is already in `ui`: the Slots group «Generación
  // {n}» is `ui.cards.generation`, the options «Normal» and «Shiny» of the
  // Variante filter are `ui.cards.normal` and `ui.shiny`, and the Lista headers
  // Elementos, Tier, Requisito, Rol and Variante are `ui.tooltip.*` and
  // `ui.cards.variant`. The options of the Tier filter are `formatTier` of the
  // registry's tiers, and those of Elemento the names of `content/elementos.json`.
  pokedex: {
    description:
      'Las {n} variantes de Pokémon de PokeAlliance con nivel requerido, tier, elementos y rol.',
    count: { one: '{n} variante', other: '{n} variantes' },
    countNormal: { one: '{n} normal', other: '{n} normales' },
    countShiny: '{n} Shiny',
    empty: 'No hay Pokémon que coincidan con estos filtros.',
    clearFilters: 'Limpiar filtros',
    caption: 'Pokédex, todas las variantes',
    captionNormal: 'Pokédex, variantes normales',
    captionShiny: 'Pokédex, variantes Shiny',
    columnSprite: 'Sprite',
    columnNumber: 'Nº',
    columnName: 'Nombre',
    // `FilterBar` of step 3 (§8.2, P-10, P-11): the visible label of each filter
    // and its first option, which clears it. The Spanish option agrees with its
    // label: «Todas» for Generación and Variante, «Todos» for Tier and Tipo.
    // «Moveset» fact of the card (§16.4.2), a game term (13.4).
    moveset: 'Moveset',
    filters: {
      generation: 'Generación',
      tier: 'Tier',
      // Direction C's filter toolbar (`FilterMenuButton`): the elements button is «Tipo», not
      // «Elemento» (`ui.tooltip.element`/`elements` keep «Elemento» for the fact rows,
      // unrelated). Its rule (AND, capped at 2) and Tier's own order (best to worst) are said
      // inside their own menu panel, not next to this name (`ui.filterBar.typeRuleHint`).
      element: 'Tipo',
      variant: 'Variante',
      // Tipo de moveset (§16.2.2, §16.4.2): oculto sin datos (C-R5, D-R5).
      movesetType: 'Tipo de moveset',
      // `FilterToolbar`: the name of the search field and its example.
      search: 'Buscar en la Pokédex',
      searchPlaceholder: 'Nombre o Nº',
    },
    // `SortSelect` (§16.4.2): «Número» es el orden de hoy y no lleva texto propio.
    sort: {
      number: 'Número',
      name: 'Nombre',
      tier: 'Tier (mejor primero)',
      requirement: 'Requisito',
    },
  },
  // Pokémon page (§8.3). Whatever `ui` already carries is read from there: the
  // «Nº {n}» of the subtitle and of the description is `ui.cards.number`; the
  // sheet rows Requisito, Tier, Elementos, Rol and Generación, the drop keys
  // and columns Drop de, Elemento and Uso, the Tier column of the Tier list and
  // the Elemento column of Ataques are `ui.tooltip.*`; the sheet's name is
  // `ui.sheet`. HP, Drops, Tier list, Moveset, Slot, Cooldown, Linked Tasks,
  // Outfit and Aura read the same in both languages (§8.3, §13.4).
  pokemon: {
    // `<meta name="description">` (§13.5): `description` with `{facts}` the
    // parts that have data — `ui.cards.number`, the element names, then
    // `descriptionLevel`, `descriptionTier` and `descriptionRole` — joined with
    // «, »; `descriptionBare` when none has data.
    description: 'Ficha de {name} en la Pokédex de PokeAlliance: {facts}.',
    descriptionBare: 'Ficha de {name} en la Pokédex de PokeAlliance.',
    descriptionLevel: 'nivel requerido {level}',
    descriptionTier: 'tier {tier}',
    descriptionRole: 'rol {role}',
    // Hero: the facts grid (the Normal/Shiny links are `ui.cards.variant` and `ui.cards.normal`).
    movesetType: 'Tipo de moveset',
    // Outfit panel and its aura slots. `outfitAlt` is the alt of the idle south frame;
    // `auraBall` names the chosen aura; `auraUnavailable` shows only without WebGL.
    outfit: 'Outfit',
    outfitAlt: '{name}, Sur',
    aura: 'Aura',
    auraNone: 'Ninguna',
    auraBall: 'Aura {name}',
    auraUnavailable: 'El aura no está disponible en este navegador.',
    // The sticky section bar and the section titles, in page order.
    sectionsNav: 'Secciones de la ficha',
    sections: {
      summary: 'Resumen',
      moves: 'Movimientos',
      loot: 'Loot',
      where: 'Ubicaciones',
      evolution: 'Evoluciones',
      effectiveness: 'Efectividad',
      fieldAbilities: 'Habilidades de campo',
      variants: 'Variantes',
      trade: 'Comercio',
    },
    // Movimientos.
    movesCount: { one: '{n} movimiento', other: '{n} movimientos' },
    areaMoves: '{n} de {total} movimientos de área',
    movesCaption: 'Movimientos de {name}',
    columnSlot: 'Slot',
    columnMove: 'Movimiento',
    columnRange: 'Alcance',
    columnEffects: 'Efectos',
    columnCooldownPve: 'Cooldown PVE',
    columnCooldownPvp: 'Cooldown PVP',
    cooldown: '{n} s',
    range: { area: 'Área', objetivo: 'Objetivo', pasivo: 'Pasivo' },
    // Loot: the zones are the game's own names (13.4).
    lootZones: 'Zona del loot',
    lootCaption: 'Loot de {name} en {zone}',
    lootEmpty: 'Sin drops en {zone}.',
    columnItem: 'Ítem',
    columnChance: 'Probabilidad',
    columnQuantity: 'Cantidad',
    // Evoluciones: the hidden text of each connector and the requirement chip.
    evolvesWith: 'Evoluciona con:',
    evolutionLevel: 'Nivel {n}',
    // Efectividad: the groups of the game's Pokédex and their client multipliers.
    effectivenessCaption: 'Daño que recibe según el elemento del ataque.',
    effectivenessNone: 'Ninguno',
    effectiveness: {
      muyDebil: 'Muy débil',
      debil: 'Débil',
      neutro: 'Neutro',
      resiste: 'Resiste',
      muyResistente: 'Muy resistente',
      inmune: 'Inmune',
    },
    // Ubicaciones: the label of each `FactLine`, without the colon it adds.
    // `{species}` in `hunts` may be a nested entity (DS:FactLine).
    hunts: 'Hunts de {species}',
    linkedTasks: 'Linked Tasks',
    npcTeams: 'Equipos de NPC',
    // Comercio: the link to the listings of this Pokémon.
    tradeLink: 'Ver anuncios de {name} en Comercio',
  },
  // Tier list (§8.8, E1): the list `tiers` of 8.0.6 over the variants with a
  // tier, grouped by tier. The h1, which is also the Lista caption, and the
  // breadcrumb are the menu entry and its group (src/lib/nav/groups.ts); a group
  // title is `formatTier` of the registry and its count the number alone. The
  // texts of 8.2 the list shares — filters without Tier, count by Variante, empty
  // state and fixed column headers — are `pokedex.*`. Here: the description of
  // §13.5 (`{n}` the variants with a tier) and, after the list, the labels of the
  // two data lines of each record of `content/rotations.json` (step 7), without
  // the colon that `FactLine` adds.
  tiers: {
    description:
      'Las {n} variantes de Pokémon de PokeAlliance agrupadas por tier, con nivel requerido, elementos y rol.',
    condition: 'Condición',
    notFoundIn: 'No aparece en',
  },
  // Ítems (§8.5): the list `items` of 8.0.6, «Todo» at `/{l}/items/` and one
  // page per real Market category at `/{l}/items/c/{id}/`. The h1 of «Todo» and
  // the group crumb are the menu's «Ítems» group (src/lib/nav/groups.ts); the h1
  // of a category, its tab and its group title in «Todo» are its `nombre` in
  // `content/items/categorias.json`, and a group count is the number alone.
  // Here: the two descriptions of §13.5 (`{category}` that `nombre`), the name
  // of the category `nav`, the count, the empty state, the two Lista captions,
  // the headers `ui` lacks and «Drop de» of an item that more than one Pokémon
  // drops (7.5.3). The card keys and panel rows — Drop de, Elemento, Uso, Precio
  // NPC and Precio de tienda — and the Categoría column of «Todo» are
  // `ui.tooltip.*`.
  items: {
    description:
      'Ítems de PokeAlliance por categoría del Market, con los Pokémon que los sueltan, su elemento, su uso y sus precios en el NPC.',
    categoryDescription:
      'Ítems de la categoría {category} del Market de PokeAlliance, con los Pokémon que los sueltan, su elemento, su uso y sus precios en el NPC.',
    categoriesLabel: 'Categorías del Market',
    count: { one: '{n} ítem', other: '{n} ítems' },
    empty: 'No hay ítems en esta categoría.',
    captionAll: 'Todos los ítems',
    caption: 'Ítems de {category}',
    columnSprite: 'Sprite',
    columnItem: 'Ítem',
    droppedByCount: { one: '{n} Pokémon', other: '{n} Pokémon' },
    // §16.4.1: la página pasa a dos vistas, «Ranuras» (inventario del juego) y «Lista»; la
    // vista Cards desaparece. `searchPlaceholder` es el campo «Buscar ítem» de la página.
    searchPlaceholder: 'Buscar ítem',
    noResults: 'Ningún ítem coincide con la búsqueda.',
  },
  // Página de un ítem, /{l}/items/{id}/: la descripción de §13.5, los hechos del
  // encabezado, las secciones «Cómo se obtiene» y «Se usa para» (cada bloque solo con
  // datos) y el enlace a Comercio. Los nombres del juego (Pokémon, ítems, tiendas, zonas,
  // Battle Pass) no se traducen (13.4).
  item: {
    description: '{name}, ítem de {category} en PokeAlliance: cómo se obtiene y para qué se usa.',
    tradeable: 'Comercializable en el mercado',
    stackable: 'Apilable',
    heldTier: 'Tier',
    heldTiers: 'Tiers de {effect}',
    megaOf: 'Mega Evolución de',
    sectionsNav: 'Secciones del ítem',
    sections: {
      obtain: 'Cómo se obtiene',
      uses: 'Se usa para',
      trade: 'Comercio',
    },
    loot: 'Loot',
    lootCount: { one: '{n} Pokémon', other: '{n} Pokémon' },
    lootCaption: 'Pokémon que sueltan {name}',
    zoneAll: 'Todas',
    zoneFilter: 'Zona',
    columnPokemon: 'Pokémon',
    columnZone: 'Zona',
    columnChance: 'Probabilidad',
    columnQuantity: 'Cantidad',
    sortBy: 'Ordenar por {column}',
    market: 'Mercado',
    marketText: 'Se vende en el mercado del juego, en {category}.',
    npc: 'NPC',
    shops: 'Tiendas del juego',
    columnShop: 'Tienda',
    columnPrice: 'Precio',
    pass: 'Battle Pass',
    columnSeason: 'Temporada',
    columnLevel: 'Nivel',
    columnTrack: 'Pista',
    track: { gratis: 'Gratis', premium: 'Premium' },
    calendar: 'Calendario',
    columnMonth: 'Mes',
    columnDay: 'Día',
    columnCalendar: 'Calendario',
    afterDay21: 'Cada día después del 21',
    tasks: 'Quests, tasks y logros',
    taskType: {
      quest: 'Quest',
      'linked-task': 'Linked Task',
      'poke-task': 'Poke Task',
      daily: 'Daily',
      logro: 'Logro',
      dungeon: 'Dungeon',
    },
    crafting: 'Crafteo',
    recipesCount: { one: '{n} receta', other: '{n} recetas' },
    materials: 'Materiales',
    thisItem: 'este ítem',
    perRecipe: 'Por receta',
    workshop: 'Taller',
    timePerUnit: 'Tiempo por unidad',
    seconds: '{n} s',
    evolution: 'Evolución',
    columnEvolvesTo: 'Evoluciona a',
    elementStone: 'Stone del elemento',
    elementFragment: 'Fragment del elemento',
    tradeLink: 'Ver anuncios de {name} en Comercio',
  },
  // Sistemas (§8.4). The index of template D (8.4.1): its h1, which is also the
  // single crumb and the group crumb of every system page (8.0.4), the
  // description of §13.5 and the empty line. The system page (8.4.2): the
  // description of §13.5 for a system whose own text does not reach 50
  // characters (`{title}` its `titulo`), the generated label of a step (8.4)
  // and the automatic «Ítems» section with its list `sistema-items` (8.0.6,
  // E16): the section title, which is also its `Toc` entry and the name of its
  // Slots panel, the count, the name of its `ViewToggle`, the Lista caption
  // (`{title}` the system) and the two headers `ui` lacks. «Uso» is
  // `ui.tooltip.use`. Every title, subtitle and text of a system comes from
  // `content/sistemas/` (8.0.5, X4).
  systems: {
    title: 'Sistemas',
    description: 'Los sistemas de juego de PokeAlliance: qué hace cada uno y cómo funciona.',
    empty: 'Aún no hay sistemas publicados.',
    pageDescription: '{title} en PokeAlliance: qué es este sistema del juego y cómo funciona.',
    step: 'Paso {n}:',
    items: 'Ítems',
    itemCount: { one: '{n} ítem', other: '{n} ítems' },
    itemView: 'Vista de ítems',
    itemCaption: 'Ítems de {title}',
    columnSprite: 'Sprite',
    columnItem: 'Ítem',
  },
  // Actividades (§8.9, E2): the index of template D (8.9.1) and one page per record of
  // `content/quests.json` (8.9.2). `title` is the h1 of the index, its single crumb and the
  // group crumb of every activity page (8.0.4); `description` and `pageDescription` are the
  // descriptions of §13.5 of the index and of an activity page (`{name}` its `nombre`);
  // `empty` is the line of an index with no activity. On an activity page, `npc` labels the
  // NPC fact of the banner («NPC: Dr. Vektor», with the colon the page adds, T33; the
  // requirement fact is `ui.tooltip.requirement` and `ui.tooltip.level`), and `sections`
  // titles the h2 of step 5, which are also the entries of its `Toc`. The name, the NPCs and
  // every text of an activity come from the registry (8.0.5, X4).
  activities: {
    title: 'Actividades',
    description: 'Actividades de PokeAlliance: requisitos, NPC, pasos y recompensas de cada una.',
    pageDescription: 'Requisitos, pasos y recompensas de {name}, actividad de PokeAlliance.',
    empty: 'Aún no hay actividades publicadas.',
    npc: 'NPC',
    sections: {
      requirements: 'Requisitos',
      steps: 'Pasos',
      rewards: 'Recompensas',
      notes: 'Observaciones',
    },
  },
  // Cambios (§8.7, template C over `DS:Timeline`). `title` is the h1 (the crumb is «Comunidad
  // › Cambios», 8.0.4), `description` the one of §13.5 and `empty` the `EmptyState` of a
  // registry with no entry (C-05, CA2). `dateLabel` is the label of a step: its `fecha`
  // written with `formatDate` and the colon of the label (T33), «18/09/2026:». A section title
  // is its month through `Intl.DateTimeFormat` (8.7 step 3), and the title, points and
  // entities of a step come from `content/cambios.json` (8.0.5, X4).
  changes: {
    title: 'Cambios',
    description:
      'Historial de cambios de PokeAlliance y de esta wiki, del más reciente al más antiguo, agrupado por mes.',
    empty: 'Aún no hay cambios publicados.',
    dateLabel: '{date}:',
  },
  // Herramientas (§8.10, template D). `title` is the h1, its single crumb and the group crumb
  // of the map (8.0.4); `description` is the one of §13.5 (TI-01). The two links of the index,
  // «Guild» and «Mapa», are the entries of the menu group (src/lib/nav/groups.ts, 8.0.3).
  tools: {
    title: 'Herramientas',
    description:
      'Herramientas de la wiki de PokeAlliance: la actividad de tu guild a partir del export del juego y el mapa.',
  },
  // Comparar Pokémon until F5 (§8.14, E18): the placeholder of template E, `noindex`. `title` is
  // its h1 (the crumb is «Pokémon › Comparar Pokémon», 8.0.4), `empty` its one line and
  // `description` the meta description the layout writes. F5 fills the rest (§11).
  compare: {
    title: 'Comparar Pokémon',
    description: 'La comparación de Pokémon de PokeAlliance aún no está disponible en la wiki.',
    empty: 'La comparación de Pokémon aún no está disponible.',
  },
  // Guild (§10): the page of §10.5 and its sections, dialogs and exports. Labels that `FactLine`
  // or `GameTooltip` draw carry no colon (the component adds it). Game ranks are not here: they
  // are the client's terms, the same in both languages (E13). The texts marked G-nn are the
  // final texts of §12.14.
  guild: {
    // `title` is the prerendered h1 and the label of the «Guild» Select of account mode (§10.4).
    title: 'Guild',
    description:
      'Analiza los exports de tu guild de PokeAlliance: puntos, dailies y contribución por día, por semana y por miembro.',
    loading: 'Cargando la guild…',
    retry: 'Reintentar',
    cancel: 'Cancelar',
    // Head row (§10.5 step 3). `weekValue` takes the range of `formatDateRange`.
    head: {
      world: 'Mundo',
      members: 'Miembros',
      lastExport: 'Último export',
      week: 'Semana',
      weekValue: '{range}, día {k} de 7',
      access: 'Acceso',
      accessLocal: 'solo este navegador',
      accessAccount: { one: 'propietario y {n} oficial', other: 'propietario y {n} oficiales' },
    },
    import: 'Importar export',
    importHint: 'Exporta desde la ventana de guild del juego (Ctrl+J).',
    goals: 'Metas',
    // Kept out of the island's props (CA-10.13): see guild-empty.ts.
    empty: GUILD_EMPTY.es,
    emptyAction: 'Importar',
    // Local mode and the move to account mode (§10.4; G-21, G-31, G-41).
    signInHint:
      'Inicia sesión para guardar el historial de tu guild y abrirlo en otros dispositivos.',
    storageFull: 'No hay espacio para guardar más historial en este navegador.',
    localSnapshots: {
      one: 'Hay {n} corte en este navegador.',
      other: 'Hay {n} cortes en este navegador.',
    },
    upload: 'Subir a {guild}',
    // «Resumen» (§10.6) and its PeriodFilter (DS:PeriodFilter labels).
    summary: {
      title: 'Resumen',
      period: 'Periodo',
      periods: { today: 'Hoy', days7: '7 días', days30: '30 días', range: 'Rango' },
      from: 'Desde',
      to: 'Hasta',
      today: 'Hoy, {date} hasta las {time} (hora de Brasilia)',
      rangeDays: '{range}, {n} días',
      kpi: {
        active: 'Miembros con actividad',
        dailies: 'Dailies',
        contribution: 'Contribución',
        points: 'Puntos',
      },
      of: 'de {n}',
      inactive: '{k} sin actividad desde hace {x} días o más',
      previous: {
        days7: '7 días anteriores',
        days30: '30 días anteriores',
        yesterday: 'Ayer',
        days: '{n} días anteriores',
      },
      comparison: '{label}: {value} ({delta})',
      comparisonPlain: '{label}: {value}',
      coverage: '{label}: {c} de {n} días con export',
      emptyPeriod: 'Sin exports en este periodo. Último export: {date}.',
    },
    // «Por día» (§10.7): the chart, its compact tooltip, its hidden table and the formula line.
    // `formula` takes the tiers joined with «; », the first one after «nivel».
    days: {
      title: 'Por día',
      metric: 'Métrica',
      metrics: { points: 'Puntos', dailies: 'Dailies', contribution: 'Contribución' },
      noExport: 'sin export',
      inProgress: 'en curso',
      tipInProgress: '{day}, en curso',
      tip: {
        points: 'Puntos',
        dailies: 'Dailies',
        contribution: 'Contribución',
        active: 'Con actividad',
        since: 'Desde',
      },
      activeValue: '{a} de {n}',
      sinceMonday: 'lunes {date}',
      weekBand: 'Semana del {date}',
      caption: 'Actividad diaria de los últimos 14 días',
      goal: 'Meta diaria: {n}',
      formula: 'Puntos = {dailies} × valor por nivel (nivel {tiers}) + contribución.',
      formulaTier: '{from} a {to}: {points}',
      formulaTierOpen: '{from} o más: {points}',
      formulaGoal: 'Meta semanal: {goal} puntos por miembro.',
      formulaDay: 'El día cambia con el Server Save de las 00:00 (hora de Brasilia).',
      dailies: 'dailies',
    },
    // «Por semana» (§10.8). `comparison` holds `{points}`, drawn in 700 from `comparisonPoints`.
    weeks: {
      title: 'Por semana',
      comparison:
        'De lunes a {day}, esta semana suma {points}; la anterior sumaba {q} en los mismos días ({delta}). Dailies: {a} frente a {b}. Contribución: {c} frente a {d}.',
      comparisonPoints: '{p} puntos',
      caption: 'Totales por semana, de lunes a domingo',
      columns: {
        week: 'Semana',
        points: 'Puntos',
        dailies: 'Dailies',
        contribution: 'Contribución',
        active: 'Con actividad',
        goal: 'Meta semanal',
        levels: 'Niveles ganados',
      },
      current: 'en curso, día {k} de 7',
      coverage: '{c} de 7 días con export',
      ofMembers: '{a} de {n}',
      onPace: '{m} en ritmo',
      levels: '+{n}',
    },
    // «Miembros» (§10.9) and the CSV of §10.12 (header in the order of the spec).
    members: {
      title: 'Miembros',
      search: 'Buscar miembro',
      filter: 'Filtrar miembros',
      all: 'Todos ({n})',
      inactive: 'Inactivos ({k})',
      inactiveHelp: 'Sin dailies ni contribución desde hace {x} días o más.',
      exportPng: 'Exportar PNG',
      exportCsv: 'Exportar CSV',
      imageDownloaded: 'Imagen descargada.',
      caption: 'Puntos por miembro',
      captionInactive: 'Puntos por miembro, solo inactivos',
      count: '{a} a {b} de {n} miembros',
      columns: {
        member: 'Miembro',
        rank: 'Rango',
        level: 'Nivel',
        today: 'Hoy',
        days7: '7 días',
        days30: '30 días',
        trend: 'Tendencia',
        lastActivity: 'Última actividad',
      },
      activity: {
        today: 'hoy',
        yesterday: 'ayer',
        daysAgo: 'hace {n} días ({date})',
        between: 'entre {from} y {to}',
        none: 'sin actividad registrada',
      },
      csv: {
        header:
          'Miembro,Rango,Nivel,Hoy,7 días,30 días,Variación 7 días (%),Última actividad,Inactivo',
        yes: 'sí',
        no: 'no',
      },
    },
    // The member dialog (§10.9; G-05, G-16, G-32, G-37).
    member: {
      rank: 'Rango',
      level: 'Nivel',
      lastLogin: 'Último acceso',
      week: 'Semana',
      weekValue: '{p} de {goal} puntos',
      bands: { premium: 'Premium', onTrack: 'En meta', below: 'Bajo meta', none: 'Sin meta' },
      prorated: 'Las metas se ajustan a los días en que cada miembro pudo participar.',
      days: 'Últimos 14 días',
      columns: { day: 'Día', dailies: 'Dailies', contribution: 'Contribución', points: 'Puntos' },
      firstOfWeek: 'Primer corte de la semana',
      lowerTotal: 'Total menor que el anterior',
      split: 'Reparto de dailies',
      splitHelp:
        'Reparte las dailies del día entre las dificultades; la suma debe igualar el total.',
      splitNone: 'Este corte no tiene dailies para desglosar.',
      saveSplit: 'Guardar desglose',
      autoSplit: 'Volver a automático',
    },
    // «Importar export» (§10.10; G-15, G-19, G-20, G-48). Every ParseErrorCode maps to one of
    // `errors`: invalid_json → invalidJson, duplicate_member → duplicateMember, the rest →
    // invalidExport.
    importDialog: {
      files: 'Archivos',
      paste: 'O pega el JSON',
      submit: 'Importar',
      imported: 'Importados: {dates}.',
      replaced: 'Reemplazado: {dates}.',
      fileError: '{file}: {message}',
      errors: {
        invalidJson: 'El contenido no es un JSON válido.',
        invalidExport: 'El archivo no es un export de guild válido.',
        duplicateMember: 'Hay dos miembros con el mismo nombre.',
        noDate: 'El archivo no tiene fecha de exportación.',
        invalidDate: 'La fecha de exportación del archivo no es válida.',
      },
      snapshots: 'Cortes',
      snapshotName: 'Corte del {date}',
      columns: { date: 'Fecha', members: 'Miembros' },
      delete: 'Eliminar',
      deleteConfirm: '¿Eliminar el corte del {date}? Se recalculan los deltas de esa semana.',
    },
    // «Metas y cálculo» (§10.11; G-04, G-33, G-35, G-47). `tierOpen` is the last tier («350+»).
    goalsDialog: {
      title: 'Metas y cálculo',
      normal: 'Metas normales',
      premium: 'Metas premium',
      rows: { points: 'Puntos', dailies: 'Dailies', contribution: 'Contribución' },
      perDay: 'Por día',
      perWeek: 'Por semana',
      emptyHelp: 'Deja un campo vacío para no evaluar esa meta.',
      dailyValue: 'Puntos por daily',
      tier: '{from} a {to}',
      tierOpen: '{from}+',
      transition: 'Cambio de nivel durante la semana',
      transitions: {
        current: 'Estimar con la dificultad actual',
        previous: 'Estimar con la dificultad anterior',
        review: 'Marcar para revisar',
      },
      inactivity: 'Días sin actividad para marcar inactivo',
      save: 'Guardar',
      saving: 'Guardando…',
      invalid: { one: '{n} campo no válido', other: '{n} campos no válidos' },
    },
    // The PNG of §10.12 (G-25, G-50): the labels of its head, without colon, and its footer.
    image: {
      todayGoal: 'Meta hoy',
      dailies: 'Dailies',
      premiumGoal: 'Meta premium',
      week: 'Semana: {range}, día {k} de 7',
      lastExport: 'Último export: {date}',
      footer: 'PokeAlliance Wiki · Guild',
    },
  },
  // Cuenta (`/{l}/cuenta/`, §9.9 and §10.4, with the owner decisions of §9.15 and §9.16 over §9.9
  // where they clash; template H without crumbs). Registration (§9.15.1) applies to every account;
  // without COMERCIO_PUBLICO the page has «Acceso», the email row of «Verificación», «Guilds» and
  // «Eliminar cuenta». The island receives this namespace, the leaves of `ui` it reads,
  // `trade.presence` (§9.15.6) and `trade.channels` (the chips of «Canales de contacto»). Site
  // roles, not game ranks (X9). G-42, G-45 and G-47 give the access texts.
  account: {
    title: 'Cuenta',
    description:
      'Entra con tu correo para guardar el historial de tus guilds de PokeAlliance y dar acceso a sus oficiales.',
    retry: 'Reintentar',
    cancel: 'Cancelar',
    creating: 'Creando…',
    save: 'Guardar',
    saving: 'Guardando…',
    saved: 'Cambios guardados.',
    access: {
      signIn: 'Entrar',
      signUp: 'Crear cuenta',
      email: 'Correo',
      password: 'Contraseña',
      passwordHelp: 'Mínimo 10 caracteres.',
      signingIn: 'Entrando…',
      signedIn: 'Sesión iniciada como {email}.',
      signOut: 'Cerrar sesión',
      // «¿Olvidaste tu contraseña?» (§9.9) sends the recovery mail, whose link opens this page to
      // set the new password. `resetSent` names no address: it reads the same whether or not an
      // account exists.
      forgot: '¿Olvidaste tu contraseña?',
      newPassword: 'Nueva contraseña',
      passwordSaved: 'Contraseña cambiada.',
      // The invisible Turnstile check (§9.15.1, D-B3) when it does not pass, before «Reintentar».
      captchaError: 'No se pudo completar la comprobación contra bots.',
    },
    // Registration (§9.15.1): the account is active once the three steps are done, and until then
    // the page shows only the steps, an `ol` named `steps` with one item per step. Step 1 confirms
    // the email with the 6-digit code of the confirmation mail (`code`, `verify`, `resend`,
    // `otherEmail`). Step 2 links Discord or Google, each button only with its provider on (S11);
    // with TELEFONO_OBLIGATORIO the phone is step 2b. Step 3 is the profile: «Nombre de usuario»
    // is the public handle of Comercio (§9.9), the «Mundo» options are `content/mundos.json` and
    // the «País» names come from `Intl.DisplayNames` (ISO 3166-1 alfa-2). `termsLink` and
    // `privacyLink` name the two links of the box (drafts in docs/legal/ until the owner
    // publishes them, D-B7); `nonAffiliation` is the line of §9.15.2, the same as
    // `trade.nonAffiliation`. `errors.age` takes `{n}`, EDAD_MINIMA_CUENTA.
    register: {
      phone: 'Teléfono',
      profile: 'Perfil',
      code: 'Código',
      verify: 'Verificar',
      resend: 'Reenviar código',
      resent: 'Te enviamos un código nuevo.',
      linkDiscord: 'Vincular Discord',
      username: 'Nombre de usuario',
      usernameHelp: 'Público. De 3 a 24 caracteres: a-z, 0-9, _ y -.',
      player: 'Nombre del jugador',
      world: 'Mundo',
      country: 'País',
      birthDate: 'Fecha de nacimiento',
      birthDateHelp: 'No se muestra en tu perfil.',
      terms: 'Acepto los términos y la política de privacidad',
      termsLink: 'Términos',
      privacyLink: 'Política de privacidad',
      nonAffiliation:
        'PokeAlliance Wiki es un proyecto independiente. PokeAlliance, su servidor oficial, sus administradores y sus creadores no moderan ni garantizan este comercio. Las operaciones son entre jugadores.',
      finish: 'Completar registro',
      errors: {
        emailTaken: 'Ya hay una cuenta con ese correo.',
        disposableEmail: 'Ese dominio de correo no se admite. Usa un correo permanente.',
        code: 'Escribe el código de 6 dígitos.',
        phone: 'Escribe un número de teléfono válido.',
        username: 'Escribe de 3 a 24 caracteres: a-z, 0-9, _ o -.',
        usernameTaken: 'Ese nombre de usuario ya está en uso.',
        player: 'Escribe el nombre del jugador, de 1 a 32 caracteres.',
        playerTaken: 'Ese jugador ya está registrado en ese mundo.',
        world: 'Elige un mundo.',
        country: 'Elige un país.',
        birthDate: 'Escribe una fecha de nacimiento válida.',
        age: 'Necesitas al menos {n} años para crear una cuenta.',
        terms: 'Acepta los términos y la política de privacidad para continuar.',
      },
    },
    // «Cuentas vinculadas» (§9.15.1): Discord or Google anchor the account and Twitch is an
    // optional badge; each link button renders only with its provider on (S11). `{name}` is the
    // provider's username, `{provider}` Discord, Google or Twitch and `{days}`
    // DISCORD_EDAD_MIN_DIAS. The last anchor cannot be unlinked (`anchorRequired`).
    identities: {
      title: 'Cuentas vinculadas',
      linkDiscord: 'Vincular Discord',
      linkTwitch: 'Vincular Twitch',
      linked: 'Vinculada: {name}',
      unlink: 'Desvincular',
      taken: 'Esa cuenta de {provider} ya está vinculada a otra cuenta de PokeAlliance Wiki.',
      discordTooNew: 'Tu cuenta de Discord tiene menos de {days} días: Comercio aún no la acepta.',
    },
    // «Verificación» (§9.9): one `FactLine` per row, «Correo: verificado» with «Reenviar correo»
    // while unverified, and the phone rows and form only with TELEFONO_OBLIGATORIO (§9.15.1,
    // Twilio Verify): «Teléfono: verificado (+55 ••• ••• 1234)», `{number}` the masked number. The
    // form: the country `Select` with its calling code, «Número», «Enviar código», «Código» and
    // `register.verify`.
    verification: {
      title: 'Verificación',
      email: 'Correo',
      phone: 'Teléfono',
      verified: 'verificado',
      unverified: 'sin verificar',
      phoneVerified: 'verificado ({number})',
      country: 'País',
      number: 'Número',
      sendCode: 'Enviar código',
      codeSent: 'Te enviamos un código por SMS.',
      code: 'Código',
      changePhone: 'Cambiar teléfono',
      phoneSaved: 'Teléfono verificado.',
    },
    // «Perfil» (§9.16.3, «Editar la información propia»): country, player name and world with the
    // fields and errors of `register`, and the channels shown on listings. The username stops
    // changing after the first listing and the birth date once saved.
    profile: {
      title: 'Perfil',
      usernameLocked: 'El nombre de usuario ya no cambia: publicaste un anuncio.',
      birthDateLocked: 'La fecha de nacimiento no cambia una vez guardada.',
    },
    // «Canales de contacto» (§9.9): one row per channel with its `ContactChip` (labels in
    // `trade.channels`), its state and «Mostrar en mis anuncios». Correo, Discord, Google and
    // Twitch come verified from the account; another platform stays «Pendiente» until a moderator
    // finds the code on its public profile (D-B5).
    channels: {
      title: 'Canales de contacto',
      verified: 'Verificado',
      pending: 'Pendiente',
      show: 'Mostrar en mis anuncios',
      addOther: 'Añadir otra plataforma',
      platform: 'Plataforma',
      user: 'Usuario',
      requestCode: 'Generar código',
      codeLine:
        'Pon este código en tu perfil público de {platform}: {code}. Un moderador lo comprobará.',
      remove: 'Desvincular',
      platformInvalid: 'Escribe la plataforma, hasta 32 caracteres.',
      userInvalid: 'Escribe tu usuario en esa plataforma.',
    },
    // «Eliminar cuenta» (§9.9) and its `Dialog`, with the initial focus on «Cancelar»: `withGuilds`
    // or `withoutGuilds`, then `trade` with COMERCIO_PUBLICO and `banned` for an account banned
    // from Comercio, whose identifiers stay taken (§9.15.5).
    delete: {
      title: 'Eliminar cuenta',
      dialogTitle: '¿Eliminar tu cuenta?',
      withGuilds: {
        one: 'Se borran tu cuenta, la guild de la que eres propietario con sus cortes y tu acceso a las demás. No se puede deshacer.',
        other:
          'Se borran tu cuenta, las {n} guilds de las que eres propietario con sus cortes y tu acceso a las demás. No se puede deshacer.',
      },
      withoutGuilds: 'Se borran tu cuenta y tu acceso a las guilds. No se puede deshacer.',
      trade: 'Tus anuncios se retiran y tus reseñas quedan con el autor «Cuenta eliminada».',
      banned:
        'Tu cuenta está suspendida en Comercio: tu correo, tus cuentas de Discord y Google y tu nombre de jugador quedan reservados y no se pueden volver a registrar.',
      // Not «Eliminando…»: the §12.22 sentinel reads «nan» in it as «NaN».
      deleting: 'Borrando…',
      deleted: 'Tu cuenta se eliminó.',
    },
    guilds: {
      title: 'Guilds',
      none: 'No perteneces a ninguna guild.',
      world: 'Mundo',
      role: 'Rol',
      roles: { owner: 'Propietario', officer: 'Oficial', member: 'Miembro' },
      create: 'Crear guild',
      name: 'Nombre',
      inviteOfficer: 'Invitar oficial',
      inviteMember: 'Invitar miembro',
      link: 'Enlace de invitación',
      linkHelp: '{role}. Un solo uso; caduca el {date}.',
      copy: 'Copiar enlace',
      copied: 'Enlace copiado.',
      copyFailed: 'No se pudo copiar. Selecciona el enlace y cópialo.',
      accounts: 'Cuentas con acceso a {guild}',
      account: 'Cuenta',
      remove: 'Quitar',
      removeTitle: '¿Quitar a {account} de {guild}?',
      removeText: 'Pierde el acceso a esta guild. Los cortes no cambian.',
      delete: 'Eliminar guild',
      deleteTitle: '¿Eliminar {guild}?',
      deleteText:
        'Se borran la guild, sus cortes, sus metas y el acceso de todas sus cuentas. No se puede deshacer.',
      // An invitation link opens this page with `#invitacion=<token>` (§10.4).
      invitation: 'Tienes una invitación a una guild.',
      invitationSignIn: 'Entra o crea una cuenta para aceptar la invitación a una guild.',
      accept: 'Aceptar invitación',
      joined: 'Te uniste a {guild}.',
    },
    auth: {
      signInTitle: 'Iniciar sesión',
      signInText: 'La wiki se lee sin cuenta. La cuenta es para Comercio, guilds y tu perfil.',
      noAccount: '¿No tienes cuenta?',
      haveAccount: '¿Ya tienes cuenta?',
      showPassword: 'Mostrar contraseña',
      expiredTitle: 'Tu sesión caducó',
      expiredText: 'Entra otra vez para seguir donde estabas.',
      forgotTitle: 'Recupera tu contraseña',
      forgotText: 'Escribe el correo de tu cuenta y te enviamos un enlace para elegir otra.',
      sendLink: 'Enviar enlace',
      remembered: '¿La recordaste?',
      checkTitle: 'Revisa tu correo',
      checkText: 'Si {email} tiene cuenta, te llegó un enlace para elegir una contraseña nueva.',
      spamHint: '¿No llega? Mira en spam o promociones.',
      resendLinkIn: 'Reenviar enlace en {time}',
      resendLink: 'Reenviar enlace',
      backToSignIn: 'Volver a iniciar sesión',
      resetTitle: 'Elige una contraseña nueva',
      resetFor: 'Para {email}.',
      repeatPassword: 'Repite la contraseña',
      passwordLength: '{n} caracteres o más',
      mismatch: 'Las contraseñas no coinciden.',
      saveAndEnter: 'Guardar y entrar',
      linkExpiredLead: 'Ese enlace venció o ya se usó.',
      linkExpiredText: 'Cada enlace sirve una vez.',
      requestAnother: 'Pedir otro enlace',
      signUpTitle: 'Crea tu cuenta',
      signUpText: 'La cuenta es para Comercio, guilds y tu perfil. La wiki se lee sin ella.',
      emailHelp: 'Te enviamos un código de 6 dígitos para confirmarlo.',
      stepIdentity: 'Identidad',
      stepsAt: 'Pasos del registro, paso {n} de {total}',
      stepsDone: 'Pasos del registro, completo',
      stepDone: '(hecho)',
      confirmTitle: 'Confirma tu correo',
      codeSentTo: 'Te enviamos un código de 6 dígitos a',
      changeEmail: 'Cambiar correo',
      resendIn: 'Reenviar código en {time}',
      codeSpam:
        '¿No llega? Mira en spam o promociones. El correo también trae un enlace que confirma la cuenta sin escribir el código.',
      confirm: 'Confirmar',
      codeInvalid: 'Ese código no es válido o ya venció.',
      confirmedTitle: 'Correo confirmado',
      confirmedText: '{email} quedó confirmado. Sigue con el paso 2: vincula Discord o Google.',
      continue: 'Continuar',
      confirmedElsewhereLead: 'Correo confirmado.',
      confirmedElsewhereText:
        'Para seguir, inicia sesión aquí o vuelve a la pestaña donde empezaste.',
      linkUsedLead: 'Ese enlace ya no sirve.',
      linkUsedText: 'Escribe el código del correo más reciente o pide otro en el paso 1.',
      identityTitle: 'Vincula Discord o Google',
      identityText:
        'Una persona real por cuenta: cada Discord o Google solo puede estar en una cuenta del sitio. Basta con uno.',
      continueGoogle: 'Continuar con Google',
      discordHint: 'Comercio pide Discord con al menos {days} días de antigüedad.',
      or: 'o',
      linked: 'Vinculado',
      linkedAs: 'Vinculado · {name}',
      remove: 'Quitar',
      addLater: '{provider} lo puedes añadir después en Cuenta › Conexiones.',
      linkingTitle: 'Vinculando con {provider}…',
      linkingText: 'Volverás al paso 2 en un momento.',
      slowLead: 'Esto tarda más de lo normal.',
      slowText: 'Puedes esperar o volver e intentarlo otra vez.',
      backToStep: 'Volver al paso 2',
      takenLead: 'Esa cuenta de {provider} ya está en otra cuenta del sitio.',
      takenText: 'Entra con esa cuenta o vincula otra.',
      cancelledLead: 'Cancelaste la vinculación con {provider}.',
      cancelledText: 'No se guardó nada; puedes intentarlo otra vez.',
      providerDownLead: 'No pudimos hablar con {provider}.',
      providerDownText: 'No se guardó nada.',
      profileTitle: 'Tu perfil',
      profileText:
        'Tu nombre de usuario y tu personaje principal se ven en tu perfil y en tus anuncios.',
      mainCharacterTitle: 'Tu personaje principal',
      mainCharacterText:
        'Publicas con él en Comercio. Después puedes añadir otros en Cuenta, hasta {max}.',
      day: 'Día',
      month: 'Mes',
      year: 'Año',
      doneTitle: 'Listo',
      doneText: 'Tu cuenta {username} está activa.',
      doneDiscord: 'Para Comercio te falta Discord, con al menos {days} días de antigüedad.',
      link: 'Vincular',
      backToWiki: 'Volver a la wiki',
      toAccount: 'Ir a mi cuenta',
    },
    panel: {
      nav: 'Secciones de la cuenta',
      groups: { cuenta: 'Cuenta', comercio: 'Comercio', guild: 'Guild' },
      sections: {
        resumen: 'Resumen',
        perfil: 'Perfil',
        personajes: 'Personajes',
        conexiones: 'Conexiones',
        seguridad: 'Seguridad',
        canales: 'Canales de contacto',
        estado: 'Estado en línea',
        guilds: 'Guilds',
        eliminar: 'Eliminar cuenta',
      },
      card: { label: 'Tu cuenta', memberSince: 'Miembro desde {date}', myProfile: 'Mi perfil' },
      summary: {
        requirements: 'Requisitos de Comercio',
        ready: 'Puedes publicar y contactar',
        notReady: 'Te faltan requisitos',
        pending: 'pendiente',
        registration: 'Registro completo',
        registrationDetail: 'Correo, identidad y perfil',
        age: '{n} años o más',
        ageDetail: 'Según tu fecha de nacimiento',
        discord: 'Discord de {days} días o más',
        channel: 'Un canal de contacto visible',
        suspension: 'Sin suspensión en Comercio',
        consent: 'Consentimiento de dinero real',
        consentDetail:
          'Se pide la primera vez que publiques o contactes un anuncio con dinero real.',
        presenceHelp: 'Se ve junto a tus anuncios y en tu perfil.',
        changePresence: 'Cambiar estado',
        comercioReady: 'Comercio listo',
        guildsMore: '{guild} y {n} más',
        visibleChannels: { one: '{n} visible', other: '{n} visibles' },
      },
      connections: {
        intro:
          'Discord o Google ata tu cuenta a una persona real: necesitas al menos uno, y cada uno solo puede estar en una cuenta del sitio.',
        badge: 'Insignia opcional',
        notLinked: 'Sin vincular',
        ageDays: { one: 'cuenta de {n} día', other: 'cuenta de {n} días' },
        ageMonths: { one: 'cuenta de {n} mes', other: 'cuenta de {n} meses' },
        ageYears: { one: 'cuenta de {n} año', other: 'cuenta de {n} años' },
        discordOk: 'Cumple los {days} días que pide Comercio.',
        onlyAnchor: 'Es tu única identidad',
        onlyAnchorHelp: 'Es tu única identidad. Vincula {provider} para poder quitarla.',
        anchorHint: 'Con {provider} vinculado podrías quitar {other} sin perder la cuenta.',
        twitchHint: 'Se muestra como insignia en tu perfil.',
        channelsHint: 'Discord también puede ser tu canal de contacto en Comercio:',
      },
      security: {
        confirmed: 'Confirmado',
        unconfirmed: 'Sin confirmar',
        changePassword: 'Cambiar contraseña',
        sessions: 'Sesiones',
        signOutHelp: 'Cerrar sesión te pone en «Desconectado».',
      },
      profileIntro: 'Tu nombre de usuario, tu personaje principal y tu país se ven en tu perfil.',
      // «Personajes» (owner rule of 2026-09-24): up to `{max}` (PERSONAJES_MAX) game characters,
      // each a player name and a world; `{name}` a player name, `{n}` a count. The refusals of the
      // character functions are `errors`, by their fixed reason.
      characters: {
        intro:
          'Cada anuncio se publica como uno de tus personajes. Pokémon, Items y Diamonds solo se venden en su mundo; los Pokédólares, a jugadores de cualquier mundo.',
        main: 'Principal',
        listings: { one: '{n} anuncio', other: '{n} anuncios' },
        noListings: 'Sin anuncios',
        makeMain: 'Hacer principal',
        edit: 'Editar',
        remove: 'Quitar',
        hasListings:
          'Tiene anuncios: no se puede quitar ni renombrar. Para usar otro nombre o mundo, añade otro personaje.',
        isMain: 'Es tu personaje principal: haz principal a otro para quitarlo.',
        add: 'Añadir personaje',
        addSubmit: 'Añadir',
        editTitle: 'Editar {name}',
        help: 'Escríbelo como aparece en el juego. Cada personaje solo puede estar en una cuenta.',
        count: '{n} de {max}',
        limit: 'Quita un personaje sin anuncios para añadir otro.',
        mainChanged: '{name} es ahora tu personaje principal.',
        mainChangedText: 'Se ve en tu perfil y se elige primero al publicar.',
        profileRow: 'Personaje principal',
        profileMore: 'y {n} más',
        total: { one: '{n} personaje', other: '{n} personajes' },
        errors: {
          player_name_taken: 'Ese personaje ya está en otra cuenta.',
          player_name_taken_text: 'Si es tuyo, repórtalo.',
          character_limit: 'Ya tienes {max} personajes. Quita uno sin anuncios para añadir otro.',
          character_not_found: 'Ese personaje ya no está en tu cuenta.',
          profile_required: 'Completa tu perfil antes de añadir personajes.',
          suspended: 'Tu cuenta está suspendida en Comercio: no puedes cambiar tus personajes.',
          player_name_invalid: 'Escribe el nombre del jugador, de 1 a 32 caracteres.',
          world_invalid: 'Elige un mundo.',
          character_has_listings: 'Ese personaje tiene anuncios: no se puede quitar ni renombrar.',
          character_is_main: 'No puedes quitar tu personaje principal.',
        },
      },
      channelsIntro:
        'Por dónde te escribe la otra parte de una operación. En tus anuncios solo se ve el nombre del canal; tu usuario, nunca.',
      channelsFooter: 'Publicar pide al menos un canal verificado y visible.',
      presenceHelp:
        'Se ve junto a tus anuncios y en tu perfil. Pasas a «Ausente» tras {hours} horas sin actividad y a «Desconectado» tras {minutes} minutos sin el sitio abierto.',
      manage: 'Gestionar',
    },
  },
  // «Mi perfil» (`/{l}/cuenta/perfil/`, §9.16.3): prerendered, one island. `title` is the h1 and
  // the `<title>`. Without a session the page shows `signInNotice` with `shell.account.signIn`,
  // and an account with registration steps missing gets `shell.account.completeRegistration`.
  // The header card: «{jugador} · {mundo}», the country name from `Intl.DisplayNames`,
  // `memberSince` (`{date}` as «09/2026»), the linked identities as chips (`trade.channels`) and
  // the status control (`trade.presence`, with COMERCIO_PUBLICO). Only with COMERCIO_PUBLICO:
  // `publicProfile`, the reputation (the blocks and counts of `trade.reputation`, the bar named
  // `distribution`) and the tabs, whose state is `?pestana=` (`tabs` by id). A listing's actions
  // are `trade.manage` and its state line `trade.states`; a review shows its stars as
  // `trade.seller.reviewScore`, its deal as `reviews.deal` and a deleted counterpart as
  // `trade.review.deletedAuthor`. Without COMERCIO_PUBLICO the page has the header card and
  // `myGuilds`.
  profile: {
    title: 'Mi perfil',
    description:
      'Tu nombre de usuario, tu jugador y mundo de PokeAlliance y las cuentas vinculadas a tu perfil.',
    signInNotice: 'Inicia sesión para ver tu perfil.',
    memberSince: 'Miembro desde {date}',
    country: 'País',
    identities: 'Cuentas vinculadas',
    editProfile: 'Editar perfil',
    publicProfile: 'Ver perfil público',
    myGuilds: 'Mis guilds',
    reputation: 'Reputación',
    noReviews: 'Sin reseñas todavía.',
    distribution: 'Reseñas por estrellas',
    tabsLabel: 'Secciones del perfil',
    tabs: {
      listings: 'Anuncios',
      received: 'Reseñas recibidas',
      given: 'Reseñas hechas',
      deals: 'Operaciones',
    },
    // «Anuncios»: every own listing in any state, newest first, with one filter chip per state
    // (by `estado`, with its count).
    listings: {
      filtersLabel: 'Estado del anuncio',
      filters: {
        publicado: 'Publicados',
        reservado: 'Reservados',
        expirado: 'Expirados',
        completado: 'Completados',
        retirado: 'Retirados',
      },
      empty: 'Aún no publicaste anuncios.',
      emptyFilter: 'Ningún anuncio en este estado.',
    },
    // «Reseñas recibidas» and «Reseñas hechas», 10 per page: the role of the reviewed account,
    // the deal number (`{number}`, «OP-000123») and «Editar» while the author may still edit.
    reviews: {
      asSeller: 'como vendedor',
      asBuyer: 'como comprador',
      deal: 'Operación {number}',
      edit: 'Editar',
      emptyReceived: 'Aún no recibiste reseñas.',
      emptyGiven: 'Aún no hiciste reseñas.',
    },
    // «Operaciones»: the counts of pending and confirmed deals and the link to
    // `/{l}/comercio/operaciones/`.
    deals: {
      pending: { one: '{n} operación pendiente', other: '{n} operaciones pendientes' },
      confirmed: { one: '{n} operación confirmada', other: '{n} operaciones confirmadas' },
      link: 'Ver mis operaciones',
    },
  },
  // Comercio (§9), phase A: sample data, no account and no contact (9.2). The list
  // `/{l}/comercio/` (9.5), the detail of a listing (9.6), the publish page (9.7) and a seller's
  // profile (9.8). The h1 of the list and the crumbs «Comunidad › Comercio» are the menu entry and
  // its group (src/lib/nav/groups.ts). An island receives `ui` and the parts of `trade` its surface
  // needs, never the whole dictionary (§13.2). Game terms keep the client's spelling in both
  // languages (T23, §13.4): Held Items, Memory Slots, Star Level, Boost, NPC Price, Diamonds and
  // the training skills. The currency is Pokédólares, with its sprite before every amount (S8).
  trade: {
    // `<meta name="description">` (§13.5) of the list, of a detail (`{title}` the accessible title
    // of `listingTitle`, 9.4), of a seller's profile (`{name}` its `nombre`) and of the publish
    // page. The last three pages are `noindex` (9.3).
    description:
      'Anuncios de Pokémon, ítems, Diamonds y Pokédólares de PokeAlliance con contacto verificado del vendedor y reseñas de operaciones.',
    detailDescription:
      'Anuncio de {title} en el Comercio de PokeAlliance: precio, mundo y vendedor.',
    sellerDescription:
      'Perfil de {name} en el Comercio de PokeAlliance: anuncios activos, reseñas de operaciones y contacto verificado.',
    createDescription:
      'Crea un anuncio de Pokémon, ítems, Diamonds o Pokédólares de PokeAlliance como uno de tus personajes.',
    // The button of the search row (9.5.1), the action of the empty list (9.5.10, CA-9.1) and the
    // h1 of the publish page (9.7.1) in phase A. Phase B says «Publicar anuncio».
    create: 'Crear anuncio',
    // Asset types (9.4, R4) in their fixed order: the tabs of the list with «Todos» first and of
    // the form without it (9.7.1), the `CardGroup` of each type and the Slots groups (9.5.8).
    // «Items» is the asset type of Comercio (X6). `typeLabel` is the visible label of both tab
    // groups; «Pokémon» is also the first row of a tooltip titled with the nickname (9.5.9).
    typeLabel: 'Tipo de activo',
    types: {
      all: 'Todos',
      pokemon: 'Pokémon',
      items: 'Items',
      diamonds: 'Diamonds',
      pokedolares: 'Pokédólares',
    },
    // The «Tipo» column of the Lista (9.5.8): one listing each.
    typeNames: {
      pokemon: 'Pokémon',
      items: 'Item',
      diamonds: 'Diamonds',
      pokedolares: 'Pokédólares',
    },
    // By `estado`: the state line of a detail (9.6) and «· Reservado» after a card meta (9.5.8).
    // «Retirado» is what the seller and the moderators see of a withdrawn listing (9.6, phase B).
    states: {
      reservado: 'Reservado',
      completado: 'Completado',
      expirado: 'Expirado',
      retirado: 'Retirado',
    },
    // The public label of a verified channel (9.9) by type: `{code}` is the country calling code
    // of the phone («Teléfono +55»). Another platform shows its own name. `channelLabel` of
    // src/lib/trade/types.ts writes it. Google is a channel once its owner shows it (9.15.1).
    channels: {
      correo: 'Correo',
      telefono: 'Teléfono {code}',
      discord: 'Discord',
      twitch: 'Twitch',
      google: 'Google',
    },
    // The labels of `ListingCard` (DP1): one per fact key, in the order of `listingKeys`
    // (src/lib/cards/layout.ts), and the rows of its footer. The page adds `reserved`
    // (`states.reservado`), `shiny` (`ui.shiny`) and `money` (`ui.money`). The same words name the
    // rows of a listing tooltip (9.5.9) and of its sheet (9.6), and the Lista columns «Dinero
    // real», «En el juego» and «Vendedor».
    listing: {
      equipment: 'Equipo',
      keys: {
        requirement: 'Requisito',
        tier: 'Tier',
        elements: 'Elementos',
        ball: 'Ball',
        aura: 'Aura',
        boost: 'Boost',
        nickname: 'Nickname',
        memorySlots: 'Memory Slots',
        starLevel: 'Star Level',
        npcPrice: 'NPC Price',
        quantity: 'Cantidad',
        category: 'Categoría',
        element: 'Elemento',
        use: 'Uso',
        droppedBy: 'Drop de',
        boughtAt: 'Se compran en',
        usedFor: 'Se usan en',
      },
      fiat: 'Dinero real',
      game: 'En el juego',
      seller: 'Vendedor',
      contact: 'Contacto verificado',
      negotiable: 'A convenir',
    },
    // The NPC Price of a Pokémon the NPC does not buy (9.5.8), a game term; and the end of the
    // preview meta, «{Mundo} · ahora» (9.7.6).
    unsellable: 'Unsellable',
    now: 'ahora',
    // Words several surfaces share: «Mundo» (filter, column, tooltip row, form field, copied
    // line), «Precio» (filter, section of a detail, fieldset of the form), «Moneda» (the select of
    // a real currency and of an in-game option) and «Operaciones confirmadas» (detail and
    // profile, 9.6, 9.8).
    world: 'Mundo',
    price: 'Precio',
    currency: 'Moneda',
    confirmed: 'Operaciones confirmadas',
    // The list (9.5): the hidden label and the example of the search field (DS:guias/40); the
    // count of the results bar; the orders of `SortSelect` by their id in the URL (9.5.5, U3); the
    // hidden caption of the Lista and the headers no other key carries; and the empty states of
    // 9.5.10. A search with no result is `search.empty`. The order `valoracion` is «Reputación»
    // (9.15.4), the weighted score over distinct counterparts.
    list: {
      searchLabel: 'Buscar anuncios',
      searchPlaceholder: 'Shiny Ditto +20, Premier, Memory Slots 6, Fire Stone, 50kk…',
      count: { one: '{n} anuncio', other: '{n} anuncios' },
      sort: {
        recientes: 'Recientes',
        valoracion: 'Reputación',
        precio: 'Precio, menor primero',
      },
      caption: 'Anuncios de Comercio',
      columnSprite: 'Sprite',
      columnListing: 'Anuncio',
      columnType: 'Tipo',
      columnPosted: 'Publicado',
      empty: 'Aún no hay anuncios.',
      noMatches: 'Ningún anuncio coincide con estos filtros.',
      clearFilters: 'Quitar filtros',
    },
    // `FilterBar` of the list (9.5.4): the first option of each select, which clears it; the
    // legend of «Precio» while no currency is chosen, when its two fields are disabled; their
    // hidden labels and the hidden description of an invalid end; and the rating filter, whose
    // options read «4.5 o más» (`{score}` written by `formatRating`, X5).
    filters: {
      allCurrencies: 'Todas',
      minLabel: 'Precio mínimo',
      maxLabel: 'Precio máximo',
      invalidAmount: 'Importe no válido',
      rating: 'Valoración del vendedor',
      allRatings: 'Todas',
      ratingAtLeast: '{score} o más',
      // The list filter of 9.15.6: only sellers «En el juego».
      onlyInGame: 'Solo en el juego',
    },
    // A listing tooltip (9.5.9): the title of its training section, the market row with the
    // public channel labels and the seller's value; a seller without reviews is the name alone.
    tip: {
      training: 'Entrenamiento: {n}',
      contact: 'Contacto',
      seller: '{name}, {score} ({n})',
    },
    // The detail (9.6): the line under the h1 after the world, `{date}` written by `formatDate`;
    // and the rows its sheet adds to the tooltip's, with the title of the «Ditto Memory» section.
    detail: {
      posted: 'Publicado el {date}',
      addon: 'Addon',
      nextBoost: 'Next Boost chance',
      dittoMemory: 'Ditto Memory: {n}',
    },
    // A seller's profile (9.8): the labels of its data row (the value of «Valoración» is
    // `ratingValue`, `{reviews}` being `reviewCount`, or `noReviews`), the sections «Anuncios» and
    // «Reseñas» after «Contacto verificado» (`listing.contact`), the line of no active listing,
    // the hidden caption and headers of the score table, the score of a review and its trade
    // (`{title}` may be the nested entity, as in `pokemon.hunts`).
    seller: {
      memberSince: 'Miembro desde',
      rating: 'Valoración',
      noReviews: 'sin reseñas',
      listings: 'Anuncios',
      reviews: 'Reseñas',
      noListings: 'Sin anuncios activos.',
      reviewsCaption: 'Reseñas por puntuación',
      columnScore: 'Puntuación',
      columnReviews: 'Reseñas',
      reviewScore: '{n} de 5',
      operation: 'Operación: {title}',
      // Phase B (9.15.1): the row of optional badges, Twitch and other verified platforms.
    },
    // The publish page (9.7) in phase A, with what `listing.keys`, `types`, `typeNames` and the
    // shared words above do not carry: the «none» options of Aura and Addon, the help of Boost,
    // the label of each memory and each held item, the legend of Held Items, the two fields of a
    // skill (the fieldset is `ui.money.training`), the field «Next Boost chance (%)» (§12.16; the
    // sheet row is `detail.nextBoost`), the option «Sin declarar» of NPC Price, the amount of a
    // price, the two actions of the in-game options, the preview, «Copiar anuncio» with its two
    // notices and the label of the text to copy by hand (9.7.7), and the errors of 9.7.5, whose
    // `{min}` and `{max}` are the limits of src/lib/trade/types.ts. The table of 9.7.5 has no line
    // for an items listing without its item (9.7.3), and every invalid field carries its own
    // message (§12.16): `errors.item` is that line.
    form: {
      // `ListingForm`: the hints under the row names of the trays (board Crear-anuncio).
      hints: {
        optional: 'Opcional',
        auras: 'Varias',
        addons: 'Varios',
        held: 'Opcionales',
        training: 'Nivel y progreso',
      },
      auraNone: 'Ninguna',
      addonNone: 'Ninguno',
      boostHelp: 'De +0 a +50.',
      memory: 'Memoria {n}',
      heldItems: 'Held Items',
      heldItem: 'Held Item {n}',
      level: 'Nivel',
      progress: 'Progreso (%)',
      nextBoost: 'Next Boost chance (%)',
      npcUndeclared: 'Sin declarar',
      amount: 'Importe',
      removeOption: 'Quitar opción',
      addOption: 'Añadir otra opción',
      preview: 'Vista previa',
      errors: {
        pokemon: 'Elige un Pokémon de la lista.',
        range: 'Escribe un número de {min} a {max}.',
        percent: 'Escribe un porcentaje de 0 a 100, con hasta 2 decimales.',
        quantity: 'Escribe una cantidad entera mayor que cero.',
        pokedolaresFraction: 'Esa cantidad no es un número entero de Pokédólares.',
        noPrice: 'Indica un precio o marca «A convenir».',
        priceOption: 'Esa opción de precio no es válida para este anuncio.',
        world: 'Elige un mundo.',
        item: 'Elige un ítem.',
      },
    },
    // Phase B (9.9 to 9.12, with the owner decisions of 9.15 over them where they clash), only with
    // COMERCIO_PUBLICO (CA-9.13). The UI never uses the three words of the §12.22 Comercio list.
    // An island that takes one of these objects whole (`operations`, `review`, `report`,
    // `moderation`) finds every word it needs inside it, so its route passes the object as a prop.
    // Buttons that several surfaces share.
    cancel: 'Cancelar',
    retry: 'Reintentar',
    // The non-affiliation line (9.15.2), one discreet line on the list. Registration step 3 reads
    // the same sentence from `account.register.nonAffiliation`.
    nonAffiliation:
      'PokeAlliance Wiki es un proyecto independiente. PokeAlliance, su servidor oficial, sus administradores y sus creadores no moderan ni garantizan este comercio. Las operaciones son entre jugadores.',
    // Adults only (9.15.2): the title of the `Dialog` a visitor without a session gets on the first
    // Comercio route, with its two buttons (the second leads to `/{l}/`), and the `Notice` of an
    // account under 18.
    adultsOnly: 'Comercio es solo para mayores de 18 años.',
    ageGate: {
      adult: 'Tengo 18 años o más',
      minor: 'Soy menor de edad',
    },
    // Real money (9.15.2): the short `Note` of a detail with a real-money price, and the consent
    // `Dialog` asked before the first real-money listing or contact: `title`, one paragraph per
    // point, «Entiendo y acepto» and `cancel` (initial focus). `{days}` is EVIDENCIA_DIAS (9.15.3).
    // The tag «Dinero real» is `listing.fiat`.
    realMoney: {
      note: 'PokeAlliance Wiki no procesa el pago ni lo devuelve. Antes de pagar, confirma en el juego el personaje del vendedor.',
      title: 'Operaciones con dinero real',
      payments:
        'PokeAlliance Wiki no procesa pagos ni garantiza operaciones: cada operación es entre las dos partes.',
      risk: 'Hay riesgo de estafa. Confirma en el juego el personaje de la otra parte antes de pagar y nunca compartas contraseñas ni códigos de tus cuentas.',
      data: 'Si hay un reporte, la moderación revisa la IP y el identificador del navegador de tus acciones de Comercio. Se guardan {days} días, o mientras siga abierto un reporte o una alerta sobre ellas.',
      sanctions: 'Las sanciones solo afectan a Comercio: la wiki y Guild siguen disponibles.',
      accept: 'Entiendo y acepto',
    },
    // Online status (9.15.6): the `ToggleGroup` of the account, of «Mi perfil» and of Comercio
    // (`label` and one option per `estado`, read by the enum), the dot with its label beside a
    // seller and on the header chip (§9.16.1), and the «Estado» radios of the account menu
    // (§9.16.2). The list filter is `filters.onlyInGame`.
    presence: {
      label: 'Estado',
      en_juego: 'En el juego',
      ausente: 'Ausente',
      desconectado: 'Desconectado',
    },
    // What stops a Comercio action (9.15.2), which the server also enforces: the line in place of
    // the action and its link to the account. `{days}` is DISCORD_EDAD_MIN_DIAS; an account under
    // 18 gets `adultsOnly`.
    requirements: {
      signIn: 'Entra o crea una cuenta para usar Comercio.',
      account: 'Completa tu cuenta para usar Comercio.',
      discord: 'Vincula Discord para usar Comercio.',
      discordAge: 'Comercio pide una cuenta de Discord con al menos {days} días.',
      consent: 'Acepta el aviso de dinero real para continuar.',
      // Canal de contacto visible, requisito de publicar (§16.4.4 paso 6, §9.15.2).
      publish:
        'Para publicar necesitas una cuenta completa, 18 años o más, una cuenta de Discord vinculada con al menos {days} días y un canal de contacto verificado y visible.',
      goToAccount: 'Ir a mi cuenta',
    },
    // The limits of 9.12.6 when the server refuses an action, `{n}` from src/lib/trade/limits.ts.
    limits: {
      reports: 'Llegaste al máximo de {n} reportes en 24 horas.',
      openDeal: 'Ya tienes una operación abierta con este anuncio.',
    },
    // A sanctioned account (9.11, 9.15.5): the `Notice` on Comercio and on the account page.
    suspension: {
      until: 'Tu cuenta está suspendida en Comercio hasta el {date}.',
      indefinite: 'Tu cuenta está suspendida en Comercio.',
      reason: 'Motivo: {reason}',
    },
    // Publishing and managing a listing in phase B (9.6, 9.7.8, 9.16.3): `title` is the h1 of the
    // publish page and the button of the search row; the seller's actions valid in each state, on
    // a detail and in «Mi perfil»; the line of a listing withdrawn by moderation.
    manage: {
      title: 'Publicar anuncio',
      publish: 'Publicar',
      edit: 'Editar',
      save: 'Guardar cambios',
      saved: 'Cambios guardados.',
      renew: 'Renovar',
      reserve: 'Reservar',
      release: 'Quitar reserva',
      complete: 'Marcar completado',
      withdraw: 'Retirar',
    },
    // El formulario guiado de §16.4.4 paso 6: con COMERCIO_PUBLICO la acción es «Publicar
    // anuncio»; sin sesión, «Inicia sesión para publicar». Sin acciones fuera del sitio (regla del
    // dueño 2026-09-24: nada de «texto para Discord»).
    composer: {
      published: 'Anuncio publicado',
      view: 'Ver anuncio',
      assetQuestion: '¿Qué vendes?',
      publish: 'Publicar anuncio',
      signInToPublish: 'Inicia sesión para publicar',
    },
    // Owner rules of 2026-09-24 (boards Comercio-filtros V2, Anuncio-detalle V1, Personajes V2,
    // Anuncio-publicado). `filterPanel`: the «Filtros» button of the list, its panel (Mundo,
    // Precio, Vendedor; a bottom sheet on a phone), the removable tokens and the line of the
    // type rail. `anyWorld`: the tag of a Pokédólares listing, sold to every world.
    filterPanel: {
      open: 'Filtros',
      clear: 'Limpiar',
      clearAll: 'Limpiar filtros',
      allWorlds: 'Todos los mundos',
      yourCharacter: 'tu personaje',
      worldNote: 'Los anuncios de Pokédólares salen en todos los mundos.',
      amountHelp: 'Acepta 50kk, 2,5k o la cifra completa.',
      pickCurrency: 'Elige una moneda para filtrar por importe.',
      from: 'desde {min}',
      upTo: 'hasta {max}',
      ratingNote: 'Con un mínimo quedan fuera los vendedores sin reseñas.',
      inGameNote: 'Vendedores con el estado «En el juego».',
      remove: 'Quitar filtro {name}',
      show: { one: 'Ver {n} anuncio', other: 'Ver {n} anuncios' },
    },
    anyWorld: 'Cualquier mundo',
    // Price per unit (src/lib/trade/unit-price.ts): «MX$ 1,80 por 1kk», the two modes of the
    // composer, the unit field with its help and the computed total.
    unitPrice: {
      per: '{price} por {unit}',
      one: 'unidad',
      mode: 'Tipo de precio',
      total: 'Total',
      perUnit: 'Por unidad',
      unit: 'Unidad',
      unitHelp: 'Cuántos cubre el precio: 1, 10, 1kk…',
      totalLine: 'Total: {price}',
      noTotal: 'Con esa unidad el precio no da un total válido.',
    },
    // The listing page (board Anuncio-detalle, Variante 1): the hero facts, the equipment slots,
    // the trade box for a buyer, for its seller and after the contact, and «Más anuncios de».
    box: {
      variant: 'Variante',
      auras: 'Auras {n}',
      none: 'Ninguno',
      noneFeminine: 'Ninguna',
      orInGame: 'o en el juego',
      noPayments: 'El sitio no procesa pagos.',
      character: 'Personaje',
      copy: 'Copiar',
      copied: 'Copiado',
      deliverIn: 'Entrega solo en {world}.',
      delivery: 'Entrega',
      reviews: { one: '{n} reseña', other: '{n} reseñas' },
      scoreOf: '{score} de 5',
      contact: 'Contacto',
      buyingAs: 'Compras como',
      copyLink: 'Copiar enlace',
      linkCopied: 'Enlace copiado',
      copyFailed: 'No se pudo copiar. El enlace está seleccionado: cópialo con Ctrl + C.',
      noCharacter: 'Ninguno de tus personajes está en {world}.',
      addCharacter: 'Añadir personaje',
      dealOpen: 'Operación abierta con {name}',
      viewDeal: 'Ver operación',
      published: 'Publicado',
      expires: 'vence el {date}',
      completedOn: 'Completado el {date}',
      publishedAs: 'Publicado como',
      openDeals: 'Operaciones abiertas',
      view: 'Ver',
      edit: 'Editar anuncio',
      reserve: 'Marcar como reservado',
      complete: 'Marcar como completado',
      withdraw: 'Retirar anuncio',
      withdrawTitle: '¿Retirar este anuncio?',
      withdrawText: 'Deja de verse en Comercio y no se puede publicar de nuevo.',
      moreFrom: 'Más anuncios de {name}',
      viewProfile: 'Ver perfil',
    },
    // «Vendes como» (board Personajes, Variante 2): the character a listing is published as.
    sellAs: {
      label: 'Vendes como',
      characters: 'Personajes',
      main: 'Principal',
      choose: 'Elige un personaje',
      worldLocked: 'Lo fija el personaje. Pokémon, Items y Diamonds solo se venden en su mundo.',
      anyWorld: 'Lo ven compradores de cualquier mundo.',
      empty: 'Aún no tienes personajes. Cada anuncio se publica como uno de ellos.',
      required: 'Elige el personaje con el que vendes.',
    },
    // Publishing and saving (board Anuncio-publicado): the busy button, the error line (its lead
    // and the reason), the dialog after «Publicar anuncio», and the edit mode of the composer.
    publishing: {
      busy: 'Publicando…',
      saving: 'Guardando…',
      failed: 'No se pudo publicar:',
      saveFailed: 'No se pudieron guardar los cambios:',
      kept: 'Tus datos siguen en el formulario.',
      visibleUntil: 'Visible en Comercio hasta el {date}.',
      link: 'Enlace del anuncio',
      another: 'Crear otro anuncio',
      mine: 'Mis anuncios',
      editTitle: 'Editar anuncio',
      loadFailed: 'No se pudo cargar el anuncio.',
      notEditable: 'Este anuncio no es tuyo o ya no se puede editar.',
    },
    // The reasons the database gives (9.12.3), after «No se pudo publicar:» or alone.
    refusals: {
      network: 'el servidor no respondió.',
      characterRequired: 'elige el personaje con el que vendes.',
      characterMissing: 'ese personaje ya no está en tu cuenta.',
      worldMismatch: 'el mundo no es el de tu personaje.',
      buyerWorld: 'necesitas un personaje en el mundo del anuncio.',
      listingLimit: 'ya tienes {n} anuncios activos. Retira o marca como completado uno en',
      channel: 'necesitas un canal de contacto verificado y visible.',
      rateLimited: 'llegaste al máximo de anuncios nuevos en 24 horas.',
      price: 'revisa el precio.',
      state: 'este anuncio ya no se puede editar.',
    },
    // «Contactar al vendedor» (9.10) on a detail and the `Notice` once the deal exists; `{number}`
    // is the deal number, `OP-` and 6 digits (9.15.4).
    contactSeller: 'Contactar al vendedor',
    dealStarted: 'Operación {number} iniciada.',
    goToDeals: 'Ver mis operaciones',
    // «Operaciones» (`/{l}/comercio/operaciones/`, 9.10, noindex), for `OperationsPanel`: h1 and
    // description, the «Compras» / «Ventas» group (`roles`) with the hidden captions of its two
    // tables, the columns, the states by `status` (read by the enum), the empty tables, the line
    // without a session with its link, the «Copiar» button of each revealed contact value
    // (`{channel}` its public label), the actions valid for each state and role, the reviewer's own
    // score (`{score}`), and the three dialogs, whose safe button is `back` (`{number}` the deal
    // number, `{max}` the length of the dispute detail).
    operations: {
      title: 'Operaciones',
      description:
        'Tus compras y ventas en el Comercio de PokeAlliance: estado, contacto y reseñas.',
      roles: 'Compras o ventas',
      purchases: 'Compras',
      sales: 'Ventas',
      captionPurchases: 'Mis compras',
      captionSales: 'Mis ventas',
      columns: {
        number: 'Operación',
        listing: 'Anuncio',
        counterpart: 'Contraparte',
        status: 'Estado',
        date: 'Fecha',
        contact: 'Contacto',
        actions: 'Acciones',
      },
      states: {
        contacto: 'En contacto',
        confirmada_vendedor: 'Confirmada por el vendedor',
        confirmada_comprador: 'Confirmada por el comprador',
        confirmada: 'Confirmada',
        cancelada: 'Cancelada',
        disputada: 'En disputa',
        caducada: 'Caducada',
      },
      emptyPurchases: 'Aún no tienes compras.',
      emptySales: 'Aún no tienes ventas.',
      signIn: 'Entra en tu cuenta para ver tus operaciones.',
      account: 'Ir a mi cuenta',
      deletedAccount: 'Cuenta eliminada',
      copy: 'Copiar',
      copyLabel: 'Copiar {channel}',
      copied: 'Copiado.',
      copyFailed: 'No se pudo copiar. Selecciona el texto y cópialo.',
      actions: {
        confirm: 'Operación completada',
        dispute: 'No se completó',
        cancel: 'Cancelar',
        review: 'Reseñar',
        editReview: 'Editar reseña',
      },
      yourReview: 'Tu reseña: {score} de 5',
      confirmTitle: '¿Completaste la operación {number}?',
      confirmText:
        'La otra parte también tiene que confirmarla. Confirmada por las dos, ya no cambia.',
      cancelTitle: '¿Cancelar la operación {number}?',
      cancelText: 'La operación se cierra sin reseña. No se puede deshacer.',
      cancelConfirm: 'Cancelar operación',
      disputeTitle: 'La operación {number} no se completó',
      disputeText:
        'La otra parte la dio por completada. La moderación revisa la operación y la confirma o la cancela.',
      disputeDetail: 'Qué pasó',
      disputeHelp: 'Hasta {max} caracteres. Lo lee la moderación.',
      disputeConfirm: 'Enviar a moderación',
      disputed: 'La operación pasó a moderación.',
      back: 'Volver',
      sending: 'Enviando…',
      retry: 'Reintentar',
    },
    // Reviews both ways (9.15.4), for `ReviewForm`: 1 to 5 stars (`star` names each one) and an
    // optional comment (`{max}` its length), no images. `title` names the other party (`{name}`)
    // and `deal` is the line under it (`{number}` the deal number, `{title}` the listing).
    // `pairCap` replaces the action once the pair reached RESENAS_PAR_DIA reviewed deals in 24
    // hours (`{n}`). `hidden` is what the reviewed account sees of a review moderation hid, and
    // `deletedAuthor` stands for an account that no longer exists (9.8, 9.9).
    review: {
      title: 'Reseñar a {name}',
      titleSeller: 'Reseñar al vendedor',
      titleBuyer: 'Reseñar al comprador',
      editTitle: 'Editar reseña',
      deal: 'Operación {number}: {title}',
      score: 'Puntuación',
      star: { one: '{n} estrella', other: '{n} estrellas' },
      scoreRequired: 'Elige de 1 a 5 estrellas.',
      comment: 'Comentario',
      commentHelp: 'Opcional. Hasta {max} caracteres.',
      submit: 'Publicar reseña',
      save: 'Guardar cambios',
      sending: 'Enviando…',
      cancel: 'Cancelar',
      sent: 'Reseña publicada.',
      saved: 'Reseña guardada.',
      pairCap:
        'Sin reseña: estas dos cuentas ya tienen {n} operaciones con reseña en las últimas 24 horas.',
      closed: 'El plazo para reseñar esta operación terminó.',
      duplicate: 'Ya reseñaste esta operación.',
      editableUntil: 'Puedes editarla hasta el {date}.',
      hidden: 'Oculta por moderación',
      deletedAuthor: 'Cuenta eliminada',
    },
    // Reputation (9.15.4), as seller and as buyer, on the profiles and beside a seller: the score
    // (`formatRating`) and its star come from the component, then `deals` and `buyers` (as seller)
    // or `sellers` (as buyer), joined with « · ».
    reputation: {
      asSeller: 'Como vendedor',
      asBuyer: 'Como comprador',
      deals: { one: '{n} operación', other: '{n} operaciones' },
      buyers: { one: '{n} comprador distinto', other: '{n} compradores distintos' },
      sellers: { one: '{n} vendedor distinto', other: '{n} vendedores distintos' },
    },
    // Reports (9.11, 9.15.5), for `ReportDialog`: the title and trigger by target (`titles`), the
    // «Motivo» options by the value of the reason enum, «Detalle» (required with «Otro»; `{max}`
    // its length), the optional deal number of a scam report (`{example}` is «OP-000123») and the
    // answers of `trade_report`.
    report: {
      titles: {
        listing: 'Reportar anuncio',
        seller: 'Reportar vendedor',
        review: 'Reportar reseña',
      },
      reason: 'Motivo',
      reasons: {
        estafa: 'Estafa o intento de estafa',
        datos_personales: 'Datos personales expuestos',
        ofensivo: 'Contenido ofensivo',
        falso: 'Anuncio falso o duplicado',
        otro: 'Otro',
      },
      reasonRequired: 'Elige un motivo.',
      detail: 'Detalle',
      detailHelp: 'Obligatorio con «Otro». Hasta {max} caracteres.',
      detailRequired: 'Escribe el detalle del reporte.',
      operation: 'Número de operación',
      operationHelp: 'Opcional, como {example}.',
      operationInvalid: 'Escribe el número como {example}.',
      send: 'Enviar reporte',
      sending: 'Enviando…',
      sent: 'Reporte enviado.',
      duplicate: 'Ya reportaste esto.',
      cancel: 'Cancelar',
    },
    // Moderation (`/{l}/comercio/moderacion/`, 9.11 and 9.15.5, moderators only, noindex), for
    // `ModerationQueue`: the reports with their «Abiertos» / «Resueltos» group (`filter`), the
    // alerts and the pending channels, one `DataTable` each with its hidden caption. A target
    // names its owner (`{handle}`) and a review its author (`{author}`); a deleted account is
    // `deletedAccount`. `kinds` and `evidence` go by the alert kind: `evidence` says what matched,
    // with `{a}` and `{b}` (the two accounts), `{account}`, `{accounts}` (joined with
    // `Intl.ListFormat`), `{device}`, `{n}`, `{from}` and `{to}`, then `evidenceOperations`. The
    // actions go by the action enum (`confirm_deal` and `cancel_deal` settle a disputed deal), each
    // with its required «Motivo» (`{max}` its length) and, for a suspension, `durations`.
    moderation: {
      title: 'Moderación',
      description: 'Reportes, alertas y canales pendientes del Comercio de PokeAlliance.',
      reports: 'Reportes',
      filter: 'Estado de los reportes',
      open: 'Abiertos',
      resolved: 'Resueltos',
      reportsCaption: 'Reportes recibidos',
      columns: {
        date: 'Fecha',
        target: 'Objetivo',
        reason: 'Motivo',
        count: 'Reportes',
        detail: 'Detalle',
        actions: 'Acciones',
        kind: 'Alerta',
        evidence: 'Detalle',
        account: 'Cuenta',
        platform: 'Plataforma',
        user: 'Usuario',
        code: 'Código',
      },
      targets: {
        listing: 'Anuncio de {handle}',
        seller: 'Vendedor',
        review: 'Reseña de {author} a {handle}',
      },
      operation: 'Operación {number}',
      statuses: {
        resolved: 'Resuelto',
        dismissed: 'Descartado',
      },
      noOpenReports: 'No hay reportes abiertos.',
      noResolvedReports: 'No hay reportes resueltos.',
      alerts: 'Alertas',
      alertsCaption: 'Alertas abiertas',
      noAlerts: 'No hay alertas abiertas.',
      kinds: {
        dispositivo_contrapartes: 'Mismo dispositivo entre contrapartes',
        dispositivo_cuentas: 'Varias cuentas en un dispositivo',
        resenas_cuentas_nuevas: 'Reseñas de cuentas nuevas',
        tope_resenas: 'Tope diario de reseñas repetido',
      },
      evidence: {
        dispositivo_contrapartes:
          '{a} y {b}, contrapartes de una operación o de una reseña, usaron el mismo dispositivo ({device}) en acciones de Comercio entre el {from} y el {to}.',
        dispositivo_cuentas:
          '{n} cuentas usaron el mismo dispositivo ({device}) en acciones de Comercio entre el {from} y el {to}: {accounts}.',
        resenas_cuentas_nuevas:
          '{account} recibió {n} reseñas entre el {from} y el {to} de cuentas con menos de 14 días que solo operaron con ella: {accounts}.',
        tope_resenas:
          '{a} y {b} llegaron al tope diario de reseñas entre ellas 3 días seguidos, del {from} al {to}.',
      },
      evidenceOperations: 'Operaciones: {operations}.',
      channels: 'Canales pendientes',
      channelsCaption: 'Canales por comprobar',
      noChannels: 'No hay canales pendientes.',
      approve: 'Aprobar',
      reject: 'Rechazar',
      approved: 'Canal aprobado.',
      rejected: 'Canal rechazado.',
      actions: {
        dismiss: 'Descartar',
        withdraw_listing: 'Retirar anuncio',
        hide_review: 'Ocultar reseña',
        restore_review: 'Restaurar reseña',
        warn: 'Advertir',
        suspend: 'Suspender en Comercio',
        lift_suspension: 'Levantar suspensión',
        confirm_deal: 'Dar por confirmada',
        cancel_deal: 'Dar por cancelada',
      },
      reason: 'Motivo',
      reasonHelp: 'Obligatorio. Hasta {max} caracteres.',
      reasonRequired: 'Escribe el motivo.',
      account: 'Cuenta',
      duration: 'Duración',
      durations: {
        d7: '7 días',
        d30: '30 días',
        indefinida: 'Indefinida',
      },
      apply: 'Aplicar',
      applying: 'Aplicando…',
      done: 'Acción registrada.',
      cancel: 'Cancelar',
      retry: 'Reintentar',
      deletedAccount: 'Cuenta eliminada',
    },
  },
  // Mapa (§8.11, R9): the placeholder of template E, `noindex` while it has no content of its
  // own. `title` is its h1 (the crumb is «Herramientas › Mapa», 8.0.4), `empty` its one line
  // and `description` the meta description, which promises no interactive map (§12.15).
  map: {
    title: 'Mapa',
    description: 'El mapa de PokeAlliance aún no está disponible en la wiki.',
    empty: 'El mapa aún no está disponible.',
  },
  // 404 (§8.12, template E, `noindex`, no crumbs, E4). `notFound` is its h1, which is also its
  // `<title>` and, on this `noindex` page, its description (13.5 gives it none of its own);
  // `notFoundLine` is the line under it, `{path}` the requested path as escaped text, cut to 120
  // characters with «…». The search trigger reads `shell`, and the Destacados are
  // `home.featured` over `content/destacados.json`.
  errors: {
    notFound: 'Página no encontrada',
    notFoundLine: 'No existe ninguna página en {path}.',
  },
  format: {},
  seo: {},
} as const satisfies MessageTree;
