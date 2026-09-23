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
    footer: 'Alliance Codex es un proyecto comunitario independiente, no afiliado a PokeAlliance.',
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
    documentTitle: 'Alliance Codex · Wiki de PokeAlliance',
    description:
      'Wiki comunitaria de PokeAlliance: Pokédex, sistemas, ítems, actividades, comercio y herramientas de guild.',
    title: 'Bienvenido a Alliance Codex',
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
    // label: «Todas» for Generación and Variante, «Todos» for Tier and Elemento.
    filters: {
      generation: 'Generación',
      allGenerations: 'Todas',
      tier: 'Tier',
      allTiers: 'Todos',
      element: 'Elemento',
      allElements: 'Todos',
      variant: 'Variante',
      allVariants: 'Todas',
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
    // The two sheet rows `ui.tooltip` does not carry (§8.3 step 3), without the
    // colon that `GameTooltip` adds.
    hp: 'HP',
    experience: 'Experiencia',
    // Outfit panel and its Aura group (§8.3 step 3, D-11 to D-16). `outfitAlt`
    // is the alt of the idle south frame; `auraBall` names the ball drawn over
    // the panel with an aura on; `auraUnavailable` shows only without WebGL.
    outfit: 'Outfit',
    outfitAlt: '{name}, Sur',
    aura: 'Aura',
    auraNone: 'Ninguna',
    auraBall: 'Aura {name}',
    auraUnavailable: 'El aura no está disponible en este navegador.',
    // Section titles (h2) and their `Toc` entries, in page order (§8.3 step 4).
    sections: {
      drops: 'Drops',
      tierList: 'Tier list',
      evolution: 'Evolución',
      moves: 'Ataques',
      where: 'Dónde encontrarlo',
    },
    // Drops (list `drops`, 8.0.6): the count, the name of its `ViewToggle`, the
    // Lista caption and the two headers `ui` lacks, and the Cantidad value of a
    // range; a fixed amount is the number alone.
    dropCount: { one: '{n} drop', other: '{n} drops' },
    dropView: 'Vista de drops',
    dropCaption: 'Drops de {name}',
    columnSprite: 'Sprite',
    columnItem: 'Ítem',
    quantityRange: '{min} a {max}',
    // «Drop de» of an item that more than one Pokémon drops (7.5.3).
    droppedByCount: { one: '{n} Pokémon', other: '{n} Pokémon' },
    // Tier list (list `familia`, E15): the count, the name of its `ViewToggle`,
    // the Lista caption with an evolution line (`{name}` its first stage) or
    // without one (`{n}` the Pokédex number), and its Pokémon and Moveset headers.
    familyCount: { one: '{n} variante', other: '{n} variantes' },
    familyView: 'Vista de la Tier list',
    familyCaption: 'Tier list de la familia de {name}',
    variantsCaption: 'Variantes de Nº {n}',
    columnPokemon: 'Pokémon',
    columnMoveset: 'Moveset',
    // `EvolutionChain`: the hidden text of each connector (DS:EvolutionChain).
    evolvesWith: 'Evoluciona con:',
    // The requirement chip of a connector: the level the Pokémon evolves at.
    evolutionLevel: 'Nivel {n} del Pokémon',
    // Ataques: the caption, the headers `ui` lacks, the Cooldown value in
    // seconds and the h3 over the abilities.
    movesCaption: 'Ataques de {name}',
    columnSlot: 'Slot',
    columnMove: 'Ataque',
    columnCooldown: 'Cooldown',
    cooldown: '{n} s',
    abilities: 'Habilidades',
    // Dónde encontrarlo: the label of each `FactLine`, without the colon it adds.
    // `{species}` in `hunts` may be a nested entity (DS:FactLine).
    hunts: 'Hunts de {species}',
    linkedTasks: 'Linked Tasks',
    npcTeams: 'Equipos de NPC',
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
      footer: 'Alliance Codex · Guild',
    },
  },
  // Cuenta (`/{l}/cuenta/`, §9.9 without Comercio, §10.4; template H without crumbs). Only
  // «Acceso» and «Guilds» exist until M14. The island receives this namespace and the leaves of
  // `ui` it reads. Site roles, not game ranks (X9). G-42, G-45 and G-47 give the access texts.
  account: {
    title: 'Cuenta',
    description:
      'Entra con tu correo para guardar el historial de tus guilds de PokeAlliance y dar acceso a sus oficiales.',
    retry: 'Reintentar',
    cancel: 'Cancelar',
    creating: 'Creando…',
    access: {
      title: 'Acceso',
      signIn: 'Entrar',
      signUp: 'Crear cuenta',
      email: 'Correo',
      password: 'Contraseña',
      passwordHelp: 'Mínimo 8 caracteres.',
      signingIn: 'Entrando…',
      created: 'Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.',
      signedIn: 'Sesión iniciada como {email}.',
      signOut: 'Cerrar sesión',
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
      'Crea un anuncio de Pokémon, ítems, Diamonds o Pokédólares de PokeAlliance y copia su texto.',
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
    states: {
      reservado: 'Reservado',
      completado: 'Completado',
      expirado: 'Expirado',
    },
    // The public label of a verified channel (9.9) by type: `{code}` is the country calling code
    // of the phone («Teléfono +55»). Another platform shows its own name. `channelLabel` of
    // src/lib/trade/types.ts writes it.
    channels: {
      correo: 'Correo',
      telefono: 'Teléfono {code}',
      discord: 'Discord',
      twitch: 'Twitch',
    },
    // `InfoBanner` of the list (9.5.1 step 3, A15): its three facts in reading order. It shows with
    // phase B or with listings in the set, never on the empty list of production (R12).
    banner: {
      payments: 'Alliance Codex no procesa pagos',
      contact: 'El comprador contacta al vendedor por sus canales verificados',
      reviews: 'Reseñas de 0 a 5, solo de operaciones confirmadas por ambas partes',
    },
    // The labels of `ListingCard` (DP1): one per fact key, in the order of `listingKeys`
    // (src/lib/cards/layout.ts), and the rows of its footer. The page adds `reserved`
    // (`states.reservado`), `shiny` (`ui.shiny`) and `money` (`ui.money`). The same words name the
    // rows of a listing tooltip (9.5.9) and of its sheet (9.6), and the Lista columns «Dinero
    // real», «En el juego» and «Vendedor».
    listing: {
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
    // 9.5.10. A search with no result is `search.empty`.
    list: {
      searchLabel: 'Buscar anuncios',
      searchPlaceholder: 'Shiny Ditto +20, Premier, Memory Slots 6, Fire Stone, 50kk…',
      count: { one: '{n} anuncio', other: '{n} anuncios' },
      sort: {
        recientes: 'Recientes',
        valoracion: 'Mejor valorados',
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
      allWorlds: 'Todos',
      allCurrencies: 'Todas',
      priceNeedsCurrency: 'Precio (elige moneda)',
      minLabel: 'Precio mínimo',
      maxLabel: 'Precio máximo',
      invalidAmount: 'Importe no válido',
      rating: 'Valoración del vendedor',
      allRatings: 'Todas',
      ratingAtLeast: '{score} o más',
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
      ratingValue: '{score} de 5 ({reviews})',
      reviewCount: { one: '{n} reseña', other: '{n} reseñas' },
      noReviews: 'sin reseñas',
      listings: 'Anuncios',
      reviews: 'Reseñas',
      noListings: 'Sin anuncios activos.',
      reviewsCaption: 'Reseñas por puntuación',
      columnScore: 'Puntuación',
      columnReviews: 'Reseñas',
      reviewScore: '{n} de 5',
      operation: 'Operación: {title}',
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
      copy: 'Copiar anuncio',
      copied: 'Anuncio copiado.',
      copyFailed: 'No se pudo copiar. Selecciona el texto de abajo y cópialo.',
      copyText: 'Texto del anuncio',
      errors: {
        pokemon: 'Elige un Pokémon de la lista.',
        range: 'Escribe un número de {min} a {max}.',
        percent: 'Escribe un porcentaje de 0 a 100, con hasta 2 decimales.',
        quantity: 'Escribe una cantidad entera mayor que cero.',
        pokedolaresFraction: 'Esa cantidad no es un número entero de Pokédólares.',
        noPrice: 'Indica un precio o marca «A convenir».',
        priceOption: 'Esa opción de precio no es válida para este anuncio.',
        world: 'Elige un mundo.',
        item: 'Escribe el nombre del item.',
      },
    },
    // The copied text (9.7.7, CA-9.12): one «{label}: {value}» line per declared fact, in the
    // order of the sheet. Its own labels, because in English «Selling» and «In-game» are not the
    // page's words. «o» between two options is `ui.or`, «A convenir» is `listing.negotiable` and
    // «Unsellable» is `unsellable`.
    copy: {
      selling: 'Vendo',
      nickname: 'Nickname',
      ball: 'Ball',
      aura: 'Aura',
      boost: 'Boost',
      starLevel: 'Star Level',
      memorySlots: 'Memory Slots',
      heldItems: 'Held Items',
      addon: 'Addon',
      nextBoost: 'Next Boost chance',
      training: 'Entrenamiento',
      dittoMemory: 'Ditto Memory',
      npcPrice: 'NPC Price',
      quantity: 'Cantidad',
      fiat: 'Dinero real',
      game: 'En el juego',
      world: 'Mundo',
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
