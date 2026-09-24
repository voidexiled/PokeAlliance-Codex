import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { FocusEvent, ReactNode } from 'react';

import '@/styles/components/trade-list.css';

import { CardGrid } from '@/components/cards/CardGrid';
import { CardGroup } from '@/components/cards/CardGroup';
import { ListingCard, SellerPresence } from '@/components/cards/ListingCard';
import type {
  ListingCardEntity,
  ListingCardLabels,
  ListingCardListing,
  ListingFactValue,
  SellerPresenceData,
} from '@/components/cards/ListingCard';
import type * as RowModule from '@/components/cards/ListRow';
import type * as SlotsModule from '@/components/cards/SlotsPanel';
import type * as TableModule from '@/components/content/DataTable';
import type { DataTableColumn } from '@/components/content/DataTable';
import { Chip } from '@/components/content/Chip';
import { EmptyState } from '@/components/content/EmptyState';
import { Button } from '@/components/controls/Button';
import { Checkbox } from '@/components/controls/Checkbox';
import { FilterBar } from '@/components/controls/FilterBar';
import { RangeField } from '@/components/controls/RangeField';
import type { RangeFieldValue } from '@/components/controls/RangeField';
import { Select } from '@/components/controls/Select';
import type { SelectOption } from '@/components/controls/Select';
import { SortSelect } from '@/components/controls/SortSelect';
import { TextField } from '@/components/controls/TextField';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import type { ToggleGroupOption } from '@/components/controls/ToggleGroup';
import type { ElementChipEntry } from '@/components/game/ElementChip';
import type * as SlotModule from '@/components/game/EntitySlot';
import { Sprite } from '@/components/game/Sprite';
import type { SpriteProps } from '@/components/game/Sprite';
import { MissingSprite, SpriteStage } from '@/components/game/SpriteStage';
import { EntityList } from '@/components/lists/EntityList';
import type { EntityListLabels } from '@/components/lists/EntityList';
import { URL_EVENT, useListState } from '@/components/lists/useListState';
import type { ListController } from '@/components/lists/useListState';
import { PriceOptions } from '@/components/money/PriceOptions';
import type { PriceOption } from '@/components/money/PriceOptions';
import { Rating } from '@/components/money/Rating';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import type { MessageLeaf } from '@/i18n/messages/types';
import { fill, isPluralMessage, plural } from '@/i18n/messages/types';
import { pokedexOrder } from '@/components/pokedex/config';
import { listingLayout } from '@/lib/cards/layout';
import type { ListingKey } from '@/lib/cards/layout';
import { formatTier } from '@/lib/content/format';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import type {
  Aura,
  Categoria,
  Elemento,
  Item,
  Mundo,
  OutfitRecord,
} from '@/lib/content/registry-schema';
import type { PokemonRecord, PokemonTier } from '@/lib/content/types';
import { formatDate, formatRelative } from '@/lib/format/dates';
import {
  formatDiamonds,
  formatInteger,
  formatPercent,
  formatPokedolaresLabel,
  formatRating,
  formatRealMoney,
  formatSigned,
} from '@/lib/format/numbers';
import { present } from '@/lib/format/unknown';
import { diamondsTip, elementTip, itemTip, pokemonTip } from '@/lib/game/tips';
import type {
  CurrencyTipRecord,
  TipData,
  TipHead,
  TipRow,
  TipSection,
  TipTraining,
  TipValue,
} from '@/lib/game/tips';
import { applyListState } from '@/lib/lists/state';
import type { EntityView, ListConfig, ListFilter, ListPage, ListState } from '@/lib/lists/state';
import { spriteOrNull } from '@/lib/sprites/resolve';
import type { SpriteData, SpriteRegistry } from '@/lib/sprites/resolve';
import { parsePrice } from '@/lib/trade/draft';
import type { PriceCurrency } from '@/lib/trade/draft';
import { searchText } from '@/lib/trade/search';
import { LISTING_ORDERS, listingComparator } from '@/lib/trade/sort';
import type { ListingOrder, SellerScore } from '@/lib/trade/sort';
import { listingTitle } from '@/lib/trade/title';
import type { ListingNames } from '@/lib/trade/title';
import {
  ESTADOS_ANUNCIO,
  ESTADOS_PRESENCIA,
  HABILIDADES,
  MONEDAS_JUEGO,
  MONEDAS_REALES,
  SIMBOLOS_MONEDA,
  TIPOS_ACTIVO,
  channelLabel,
  inGameFirst,
  isListed,
  sellerReputation,
} from '@/lib/trade/types';
import type {
  AddonDeclarado,
  Anuncio,
  BallDeclarada,
  ChannelLabels,
  EntrenamientoDeclarado,
  EstadoAnuncio,
  EstadoPresencia,
  HeldDeclarado,
  ItemDeclarado,
  MonedaReal,
  OpcionJuego,
  Precio,
  PrecioNpc,
  PrecioReal,
  TipoActivo,
  UnidadPokemon,
  Vendedor,
} from '@/lib/trade/types';

// TradeListRoot (spec 7.3, 7.7, 9.4, 9.5, 9.8; `Lienzo:Comercio`): the island of the Comercio
// lists. It owns what 7.7.1 leaves to a list root — the controls, the orders, the three views
// and the texts of the results bar — and hands the rest to `useListState` and `EntityList`, the
// list kit the Pokédex, Ítems and Buscar ship. Two lists, one module:
//
//   - `market`, `/{l}/comercio/` (§9.5, `ListConfig` id `comercio`): the search row (the
//     `TextField` «Buscar anuncios» and «Crear anuncio»), the type tabs, the `FilterBar` of four
//     columns («Mundo», «Moneda», «Precio», «Valoración del vendedor»), the `Checkbox` «Solo en
//     el juego» under it (9.15.6), the results bar with its `SortSelect` and `ViewToggle`, the
//     view and the pagination, 16 apart (V6). The default order «Recientes» puts the sellers «En
//     el juego» first (9.15.6, `inGameFirst`). The page renders the island only when there is a
//     listing: the production build of phase A has none and shows the empty state of 9.5.10 on
//     its own, with no control at all (CA-9.1).
//   - `seller`, the «Anuncios» section of a seller profile (§9.8 step 5, id
//     `comercio-vendedor`): `Count`, `ViewToggle` and the same three views, with no filter, no
//     search and one order, «Recientes».
//
// Data (PR5, 9.2). A row is a public listing of `content/comercio/anuncios.json` (read only
// with COMERCIO_DEMO=1, never in production, 9.2), in the language of the page: the fields of
// the `Anuncio` of 9.4 the views and the filters read, its `listingTitle` in both forms and its
// `searchText` (9.4, 9.5.2). What the catalogue says of the assets (the Pokémon record, the
// items, the elements, the auras, the addons, the worlds, the sellers and their scores) travels
// once, in `refs`, and the panels are built here with the builders of src/lib/game/tips.ts, in
// the build and in the browser alike (DP3). The props carry the first page of the default
// state; a list longer than one page asks for `dataUrl`, the whole list in the same shape, when
// it hydrates. The profile's list travels whole. Rows and refs travel as positional lists and
// without the two texts, which the decoder writes with the functions of src/lib/trade/ (see
// «the wire format»).
//
// The clock (9.4 «Estados que ve el público»). Only `publicado` and `reservado` listings whose
// `expira` is still ahead are public. The build leaves out the ones that had expired when it
// ran, and the island, with the build's instant through the hydration and the visitor's minute
// after it (and again every minute), leaves out the ones that expire afterwards. The same
// clock writes the publication: the absolute date in the prerendered HTML, the relative one
// («hace 12 min») once hydrated (9.5.8). Playwright's clock drives both in the tests.
//
// Views (9.5.8, 7.7.4):
//   - Cards: `ListingCard` in `CardGrid family="listing"`. With «Todos», and always in the
//     profile, one `CardGroup` per type in the fixed order Pokémon, Items, Diamonds,
//     Pokédólares, each with its own `listingLayout` (7.6.3): groups h2 and cards h3 in the
//     market, groups h3 and cards h4 inside the profile's section (7.6.2); with one type, no
//     group and cards h2. The card opens no panel; its Ball, elements, held items, the Diamonds
//     of a price and the «+N» of its channels do (R3).
//   - Slots: `SlotsPanel layout="side"` by type, with its label column also when a type tab
//     leaves one group (`Lienzo:Comercio` draws it so), `EntitySlot` of 72 named «{title},
//     {price}» that opens the listing panel of 9.5.9.
//   - Lista: `DataTable dense` with the eight columns of 9.5.8 at their widths, one `ListRow
//     variant="listing"` per listing, in the chosen order and never grouped.
//   Every view gives each listing the anchor `anuncio-{id}` (H7). Slots and Lista are the
//   deferred part of the island (see «the deferred part»).
//
// Every visible text arrives by props (DP1): `ui` of the page's locale and `labels`, which the
// page composes from the `trade` namespace. Nothing here picks a text by locale.

/** Listings per page (9.5.6): 24 fills 1, 2, 3 and 4 columns. */
export const TRADE_PAGE_SIZE = 24;

/**
 * The currencies of «Moneda» (9.5.4) in the order of the filter: the real ones of 9.4 and the
 * two of the game. Each id is the one the listing stores (U3), so a URL serves both locales.
 */
export const TRADE_CURRENCIES: readonly PriceCurrency[] = [...MONEDAS_REALES, ...MONEDAS_JUEGO];

function isRealCurrency(currency: PriceCurrency): currency is MonedaReal {
  return (MONEDAS_REALES as readonly string[]).includes(currency);
}

/**
 * The option of a currency in «Moneda» (9.5.4): the symbol of a real one («R$», 9.4) and the
 * name of a game one, «Pokédólares» / «Pokédollars» and «Diamonds», which are `ui.tooltip`.
 * A mention of a currency without an amount is text, with no sprite (7.8).
 */
function currencyName(currency: PriceCurrency, ui: TradeUi): string {
  if (isRealCurrency(currency)) return SIMBOLOS_MONEDA[currency];
  return currency === 'pokedolares' ? ui.tooltip.pokedolares : ui.tooltip.diamonds;
}

/** The thresholds of «Valoración del vendedor» (9.5.4), written with a point in both (X5). */
export const RATING_FLOORS = ['4.5', '4.0', '3.0'] as const;

export type RatingFloor = (typeof RATING_FLOORS)[number];

/** Art and pixel sprites from this index of a list on load lazily (7.4.2). */
const EAGER_ART = 4;

/** Art of a Lista row, drawn smooth at 40 inside the 48 box (DS:ListRow, Comercio). */
const LIST_ART = 40;

/** The id of the «Precio» range: its two fields are `${PRICE_ID}-min` and `${PRICE_ID}-max`. */
const PRICE_ID = 'ac-comercio-precio';

/**
 * Widths of the Lista columns at 944 (9.5.8, `canvas-v2/gen/gen_comercio.py:362`,
 * `:367-369`): «Anuncio» takes what is left. The board declares 72 · auto · 110 · 74 · 100 ·
 * 176 · 152 · 100 and its automatic table layout settles the sprite column at 73 (the 48 box,
 * 12 and 12 and the divider) and «Mundo» at 74.1 («Titan 1»), so «Anuncio» at 156.9 (942
 * inside the border). Written as they come out, as the Pokédex does (D-018), the table has the
 * board's columns whatever the rows of the page hold; trade-list.css lets a cell's text wrap
 * rather than widen its column (CA-9.7).
 */
const LIST_WIDTHS = {
  sprite: 73,
  type: 110,
  world: 74.1,
  fiat: 100,
  game: 176,
  seller: 152,
  posted: 100,
};

/** The hard space `formatRealMoney` writes between the symbol and the figure (§13.3). */
const HARD_SPACE = '\u00a0';

// ---------------------------------------------------------------------------------- data

/**
 * A public listing as the three views, the filters and the orders read it (9.4, 9.5). The
 * declared units are the registry's own shape; `entrenamiento` comes in the order of
 * `HABILIDADES`, so its first entry is the one the card shows (9.5.8).
 */
export interface TradeRow {
  id: string;
  tipo: TipoActivo;
  /** Handle of the seller. */
  vendedor: string;
  /** Id of a world of content/mundos.json. */
  mundo: string;
  /** ISO 8601 instants. */
  publicado: string;
  expira: string;
  /**
   * `publicado` or `reservado` in the lists, where «Reservado» follows the meta (9.5.8); any
   * state but `retirado` in the detail (9.6).
   */
  estado: EstadoAnuncio;
  /** `listingTitle(…).texto` (9.4). */
  titulo: string;
  /** `listingTitle(…).accesible`: what a screen reader hears (R5). */
  accesible: string;
  /** `searchText(…)` (9.5.2): the text `q` searches. */
  busqueda: string;
  precio: Precio;
  pokemon: UnidadPokemon | null;
  item: ItemDeclarado | null;
  /** The amount of a Diamonds or Pokédólares listing, in base units (R5). */
  cantidad: number | null;
}

/** A row without the two texts written from it and the names of `refs` (9.4, 9.5.2). */
type TradeListing = Omit<TradeRow, 'titulo' | 'accesible' | 'busqueda'>;

/** A Pokémon a listing names: its record's values the card, the panels and the title read. */
export interface TradePokemonRef {
  nombre: string;
  variante: string;
  nivel: number | null;
  tier: PokemonTier | null;
  generacion: number | null;
  funcion: string | null;
  /** Element ids, in the order of the record (8.0.5). */
  elementos: string[];
  /** `imagen` of the record, resolved in the browser by `resolvePokemonImage`. */
  imagen: string | null;
}

/** An item a listing names (the traded item, a Ball, a held item), as `itemTip` reads it. */
export interface TradeItemRef {
  nombre: string;
  categoria: string;
  /** `nombre` of its Market category in the language of the file. */
  nombreCategoria: string | null;
  /** Resolved by the sprite adapter in the build (DP2). */
  sprite: SpriteData | null;
  precioNpc: { vende: number | null; compra: number | null };
  /** Element id, or `null`. */
  elemento: string | null;
  /** `uso` in the language of the file, or `null`. */
  uso: string | null;
  /** Names of the Pokémon whose `drops` hold it, in the order of 8.0.5. */
  dropDe: string[];
  /** The one Pokémon that drops it, when it is one: the entity of «Drop de». */
  dropper: string | null;
}

/** An element of content/elementos.json in the language of the file (8.0.5). */
export interface TradeElementRef {
  nombre: string;
  icono: SpriteData | null;
  /** Names of the items of its `stone` and `fragment`, which do not translate (13.4). */
  stone: string | null;
  fragment: string | null;
}

/** An aura of content/auras.json: its name and its ball (9.5.9). */
export interface TradeAuraRef {
  nombre: string;
  icono: SpriteData | null;
}

/**
 * A seller: the score of the confirmed trades (9.15.4, the «media» of `sellerReputation`), the
 * public labels of its channels and its online status (9.15.6).
 */
export interface TradeSellerRef extends SellerScore {
  nombre: string;
  /** Labels only, never a value (R13, CA-9.9): «Discord», «Teléfono +55». */
  canales: string[];
  presencia: EstadoPresencia | null;
}

/** What the rows name, once each (PR5). */
export interface TradeRefs {
  /** The listed Pokémon, the ones of their Ditto Memory and the one that drops an item. */
  pokemon: Record<string, TradePokemonRef>;
  items: Record<string, TradeItemRef>;
  elementos: Record<string, TradeElementRef>;
  auras: Record<string, TradeAuraRef>;
  /** Addon names of content/outfits.json by id: the search reads them (9.5.2). */
  addons: Record<string, string>;
  /** World names by id. */
  mundos: Record<string, string>;
  vendedores: Record<string, TradeSellerRef>;
}

/** Rows and what they name: what the views, the panels and the pages read. */
export interface TradeRecords {
  rows: TradeRow[];
  refs: TradeRefs;
}

/**
 * The rows as they travel (PR5): the island's props and `/{l}/comercio/datos.json` share this
 * shape (see «the wire format»).
 */
export interface TradeData {
  v: 1;
  /** `TRADE_FIELDS`. */
  campos: readonly string[];
  /** One list per listing, with its values in the order of `campos`. */
  filas: readonly (readonly unknown[])[];
  /** Each table of `TradeRefs` as a list of entries, each the list of its values, `id` first. */
  refs: Readonly<Record<keyof TradeRefs, readonly (readonly unknown[])[]>>;
}

/** The fixed sprites of the list (9.5.1), resolved by the page with the adapter (DP2). */
export interface TradeSprites {
  /** Tabs, groups and stages: `outfits/5`, `items/stones/fire-stone`, `ui/diamond`, `ui/pokedolares`. */
  types: Record<TipoActivo, SpriteData | null>;
  /** `ui/comercio/item`: the stage of an item the registry does not know (9.7.3). */
  item: SpriteData | null;
}

/**
 * The `moneda` object of content/items/diamantes.json in the page's language (§3.13): the rows
 * «Se compran en» and «Se usan en» of a Diamonds listing and of the Diamonds panel.
 */
export interface TradeCurrencyLists {
  seCompranEn: readonly string[];
  seUsanEn: readonly string[];
}

/**
 * The two lists of the `moneda` object (`getMonedaDiamantes` of src/lib/content/registry.ts) in
 * the page's language. A list the owner has not filled (`null`) is empty, and an empty list makes
 * no fact and no row (§8.5, R2); with neither, the Diamonds of a price stay text.
 */
export function tradeDiamonds(
  moneda: CurrencyTipRecord | null,
  locale: Locale,
): TradeCurrencyLists {
  return {
    seCompranEn: moneda?.seCompranEn?.[locale] ?? [],
    seUsanEn: moneda?.seUsanEn?.[locale] ?? [],
  };
}

/**
 * The part of `messages.ui` a Comercio list reads (DP1): the texts of `EntityList`, of the
 * controls and of the panels. The island receives these and not all of `ui` (13.6: its props).
 */
export type TradeUi = Pick<
  Messages['ui'],
  | 'views'
  | 'pagination'
  | 'prev'
  | 'next'
  | 'page'
  | 'dataError'
  | 'sortBy'
  | 'rangeMin'
  | 'rangeMax'
  | 'tooltip'
  | 'money'
  | 'shiny'
  | 'pinHint'
  | 'or'
>;

/** `TradeUi` out of the page's `messages.ui`. */
export function tradeUi(ui: Messages['ui']): TradeUi {
  const { views, pagination, prev, next, page, dataError, sortBy, rangeMin, rangeMax } = ui;
  const { tooltip, money, shiny, pinHint, or } = ui;
  return {
    views,
    pagination,
    prev,
    next,
    page,
    dataError,
    sortBy,
    rangeMin,
    rangeMax,
    tooltip,
    money,
    shiny,
    pinHint,
    or,
  };
}

/** Every text of the list besides `ui` (DP1), composed by the page from `messages.trade`. */
export interface TradeListLabels {
  /** «Buscar anuncios»: the hidden label of the search field. */
  search: string;
  /** «Shiny Ditto +20, Premier, Memory Slots 6, Fire Stone, 50kk…» (DS:guias/40). */
  searchPlaceholder: string;
  /** «Crear anuncio» in phase A, towards `/comercio/publicar/`. */
  publish: string;
  /** «Tipo de activo», the visible label of the tabs. */
  type: string;
  /** «Todos», the tab of every type. */
  allTypes: string;
  /** Tabs, group heads and the first row of a panel titled with a nickname: «Pokémon», «Items»… */
  types: Record<TipoActivo, string>;
  /** The «Tipo» cell of the Lista: «Pokémon», «Item», «Diamonds», «Pokédólares». */
  typeCells: Record<TipoActivo, string>;
  /** «Mundo»: the filter, the Lista column and the row of a panel; and «Todos». */
  world: string;
  allWorlds: string;
  /** «Moneda» and its first option, «Todas». */
  currency: string;
  allCurrencies: string;
  /** «Precio», and «Precio (elige moneda)» while the currency is «Todas». */
  price: string;
  priceDisabled: string;
  /** Hidden labels of the two ends: «Precio mínimo», «Precio máximo». */
  minLabel: string;
  maxLabel: string;
  /** «Importe no válido»: the hidden description of an invalid end. */
  invalidAmount: string;
  /** «Valoración del vendedor» and its first option, «Todas». */
  rating: string;
  allRatings: string;
  /** «4.5 o más», «4.0 o más», «3.0 o más». */
  ratings: Record<RatingFloor, string>;
  /** The label of each online status (9.15.6): «En el juego», «Ausente», «Desconectado». */
  presence: Record<EstadoPresencia, string>;
  /** «Solo en el juego»: the filter of the sellers in the game (9.15.6). */
  onlyInGame: string;
  /** The option of each order in `SortSelect`, by its id in the URL (9.5.5). */
  sorts: Record<ListingOrder, string>;
  /** «{n} anuncio» / «{n} anuncios». */
  count: MessageLeaf;
  /** «Aún no hay anuncios.»: every listing expired while the page was open. */
  none: string;
  /** «Ningún anuncio coincide con estos filtros.» */
  emptyFilters: string;
  /** «Sin resultados para «{q}».» */
  emptyQuery: string;
  /** «Quitar filtros». */
  clearFilters: string;
  /** «Sin anuncios activos.» (the profile, 9.8). */
  emptySeller: string;
  /**
   * The headers of the Lista (9.5.8) the card has no label for; `sprite` is for screen readers
   * only. «Mundo» is `world`; «Dinero real», «En el juego» and «Vendedor» are the card's.
   */
  columns: {
    sprite: string;
    listing: string;
    type: string;
    posted: string;
  };
  /**
   * The card's own texts (DS:ListingCard), with the label of each fact key. «Dinero real», «En
   * el juego» and «Vendedor» also name the Lista columns and the rows of a panel.
   */
  card: Omit<ListingCardLabels, 'shiny' | 'money'>;
  /** The NPC Price of a Pokémon the NPC does not buy: «Unsellable», a game term. */
  unsellable: string;
  /** «Entrenamiento: {n}»: the section of a panel. */
  training: string;
  /**
   * The market block of a panel besides the card's labels and `world`: «Contacto», and
   * `sellerValue`, «{name}, {score} ({n})», the seller with reviews.
   */
  market: {
    sellerValue: string;
    contact: string;
  };
  /** «{n} Pokémon»: «Drop de» of an item that several Pokémon drop. */
  droppedByCount: MessageLeaf;
}

/** The part of the list a detail page and the profile build with the same functions. */
export interface TradeContext {
  locale: Locale;
  refs: TradeRefs;
  sprites: TradeSprites;
  diamonds: TradeCurrencyLists | null;
  ui: TradeUi;
  labels: Pick<
    TradeListLabels,
    | 'card'
    | 'unsellable'
    | 'types'
    | 'world'
    | 'training'
    | 'market'
    | 'droppedByCount'
    | 'presence'
  >;
}

/**
 * The texts of a Comercio list from the dictionary of the page's locale (DP1, 13.2): the page
 * composes them and the island receives these and `ui`, never the dictionary. A search with no
 * result says `search.empty` (9.5.10) and «Drop de» of several Pokémon is `items.droppedByCount`,
 * the words the other lists use. `publico` is phase B (9.2): only then does a listing with a
 * real-money price carry the tag «Dinero real», the word of its price row (9.15.2).
 */
export function tradeLabels(messages: Messages, publico = false): TradeListLabels {
  const { trade } = messages;
  return {
    search: trade.list.searchLabel,
    searchPlaceholder: trade.list.searchPlaceholder,
    publish: trade.create,
    type: trade.typeLabel,
    allTypes: trade.types.all,
    types: {
      pokemon: trade.types.pokemon,
      items: trade.types.items,
      diamonds: trade.types.diamonds,
      pokedolares: trade.types.pokedolares,
    },
    typeCells: trade.typeNames,
    world: trade.world,
    allWorlds: trade.filters.allWorlds,
    currency: trade.currency,
    allCurrencies: trade.filters.allCurrencies,
    price: trade.price,
    priceDisabled: trade.filters.priceNeedsCurrency,
    minLabel: trade.filters.minLabel,
    maxLabel: trade.filters.maxLabel,
    invalidAmount: trade.filters.invalidAmount,
    rating: trade.filters.rating,
    allRatings: trade.filters.allRatings,
    ratings: {
      '4.5': fill(trade.filters.ratingAtLeast, { score: formatRating(4.5) }),
      '4.0': fill(trade.filters.ratingAtLeast, { score: formatRating(4) }),
      '3.0': fill(trade.filters.ratingAtLeast, { score: formatRating(3) }),
    },
    presence: {
      en_juego: trade.presence.en_juego,
      ausente: trade.presence.ausente,
      desconectado: trade.presence.desconectado,
    },
    onlyInGame: trade.filters.onlyInGame,
    sorts: trade.list.sort,
    count: trade.list.count,
    none: trade.list.empty,
    emptyFilters: trade.list.noMatches,
    emptyQuery: messages.search.empty,
    clearFilters: trade.list.clearFilters,
    emptySeller: trade.seller.noListings,
    columns: {
      sprite: trade.list.columnSprite,
      listing: trade.list.columnListing,
      type: trade.list.columnType,
      posted: trade.list.columnPosted,
    },
    card: {
      keys: trade.listing.keys,
      fiat: trade.listing.fiat,
      game: trade.listing.game,
      seller: trade.listing.seller,
      contact: trade.listing.contact,
      negotiable: trade.listing.negotiable,
      reserved: trade.states.reservado,
      ...(publico ? { realMoney: trade.listing.fiat } : {}),
    },
    unsellable: trade.unsellable,
    training: trade.tip.training,
    market: {
      sellerValue: trade.tip.seller,
      contact: trade.tip.contact,
    },
    droppedByCount: messages.items.droppedByCount,
  };
}

// ------------------------------------------------------------------------ the wire format
//
// PR5 fixes the envelope, `{ v: 1, campos, filas, refs }`: one list per row with its values in
// the order of `campos`. A listing of 9.4 is far richer than a Pokédex row (a price with up to
// three amounts, a declared Pokémon with a dozen fields), so its parts travel the same way: the
// price, the declared Pokémon and each of its parts, the declared item and every entry of `refs`
// are the lists of their values in the order of the `*_FIELDS` lists below, which name each field
// once, here, and not once per listing. The two texts written from a listing do not travel at
// all: `decodeTradeData` writes the title and the search text from the row and the names of
// `refs` with the functions of src/lib/trade/ (9.4, 9.5.2), as `tradeRecords` does in the build.
// That keeps the props of a first page of 24 listings within the 20 KB of 13.6.

/**
 * `fields`, checked to name every key of `T` once: a field added to a type of 9.4 and not to its
 * list fails to compile instead of vanishing from the data.
 */
function fieldList<T>() {
  return <const F extends readonly (keyof T & string)[]>(
    fields: F & ([Exclude<keyof T, F[number]>] extends [never] ? unknown : never),
  ): F => fields;
}

/** The columns of a row in `filas`, in this order (PR5). */
export const TRADE_FIELDS = fieldList<TradeListing>()([
  'id',
  'tipo',
  'vendedor',
  'mundo',
  'publicado',
  'expira',
  'estado',
  'precio',
  'pokemon',
  'item',
  'cantidad',
]);

const PRICE_FIELDS = fieldList<Precio>()(['real', 'juego', 'aConvenir']);
const REAL_FIELDS = fieldList<PrecioReal>()(['moneda', 'importe']);
const OPTION_FIELDS = fieldList<OpcionJuego>()(['tipo', 'cantidad']);
const UNIT_FIELDS = fieldList<UnidadPokemon>()([
  'pokemon',
  'ball',
  'aura',
  'boost',
  'starLevel',
  'nickname',
  'memorySlots',
  'memorias',
  'helds',
  'addon',
  'nextBoostChance',
  'entrenamiento',
  'precioNpc',
]);
const BALL_FIELDS = fieldList<BallDeclarada>()(['item', 'nombre']);
const HELD_FIELDS = fieldList<HeldDeclarado>()(['item', 'nombre', 'tier']);
const ADDON_FIELDS = fieldList<AddonDeclarado>()(['id', 'nombre']);
const TRAINING_FIELDS = fieldList<EntrenamientoDeclarado>()(['habilidad', 'nivel', 'progreso']);
/** A declared NPC Price: `['unsellable', null]` or `['pokedolares', amount]`. */
const NPC_FIELDS = ['tipo', 'cantidad'] as const;
const ITEM_FIELDS = fieldList<ItemDeclarado>()(['item', 'nombre', 'cantidad']);

type WithId<T> = T & { id: string };

const POKEMON_REF_FIELDS = fieldList<WithId<TradePokemonRef>>()([
  'id',
  'nombre',
  'variante',
  'nivel',
  'tier',
  'generacion',
  'funcion',
  'elementos',
  'imagen',
]);
const ITEM_REF_FIELDS = fieldList<WithId<TradeItemRef>>()([
  'id',
  'nombre',
  'categoria',
  'nombreCategoria',
  'sprite',
  'precioNpc',
  'elemento',
  'uso',
  'dropDe',
  'dropper',
]);
const NPC_PRICE_FIELDS = fieldList<TradeItemRef['precioNpc']>()(['vende', 'compra']);
const ELEMENT_REF_FIELDS = fieldList<WithId<TradeElementRef>>()([
  'id',
  'nombre',
  'icono',
  'stone',
  'fragment',
]);
const AURA_REF_FIELDS = fieldList<WithId<TradeAuraRef>>()(['id', 'nombre', 'icono']);
const SELLER_REF_FIELDS = fieldList<WithId<TradeSellerRef>>()([
  'id',
  'nombre',
  'valoracion',
  'resenas',
  'canales',
  'presencia',
]);
/** An addon or a world: its id and its name. */
const NAME_FIELDS = ['id', 'nombre'] as const;

/** `value` as the list of its fields in the order of `fields`; an absent one is `null`. */
function pack(value: object, fields: readonly string[]): unknown[] {
  const record = value as Record<string, unknown>;
  return fields.map((field) => record[field] ?? null);
}

/** A sprite: `src`, `size`, `frames` and `mode`, then an object with the rest, if it has any. */
function packSprite(sprite: SpriteData | null): unknown[] | null {
  if (sprite === null) return null;
  const { src, size, frames, mode, ...rest } = sprite;
  return Object.keys(rest).length === 0
    ? [src, size, frames, mode]
    : [src, size, frames, mode, rest];
}

function packPrice(precio: Precio): unknown[] {
  return pack(
    {
      real: precio.real && pack(precio.real, REAL_FIELDS),
      juego: precio.juego.map((option) => pack(option, OPTION_FIELDS)),
      aConvenir: precio.aConvenir,
    },
    PRICE_FIELDS,
  );
}

function packUnit(unit: UnidadPokemon): unknown[] {
  return pack(
    {
      ...unit,
      ball: unit.ball && pack(unit.ball, BALL_FIELDS),
      helds: unit.helds.map((held) => pack(held, HELD_FIELDS)),
      addon: unit.addon && pack(unit.addon, ADDON_FIELDS),
      entrenamiento: unit.entrenamiento.map((entry) => pack(entry, TRAINING_FIELDS)),
      precioNpc: unit.precioNpc && pack(unit.precioNpc, NPC_FIELDS),
    },
    UNIT_FIELDS,
  );
}

/** `records` as PR5 carries them: the island's props and `/{l}/comercio/datos.json`. */
export function encodeTradeData({ rows, refs }: TradeRecords): TradeData {
  const table = <T extends object>(
    entries: Readonly<Record<string, T>>,
    fields: readonly string[],
    parts: (entry: T) => object = (entry) => entry,
  ) => Object.entries(entries).map(([id, entry]) => pack({ ...parts(entry), id }, fields));
  return {
    v: 1,
    campos: TRADE_FIELDS,
    filas: rows.map((row) =>
      pack(
        {
          ...row,
          precio: packPrice(row.precio),
          pokemon: row.pokemon && packUnit(row.pokemon),
          item: row.item && pack(row.item, ITEM_FIELDS),
        },
        TRADE_FIELDS,
      ),
    ),
    refs: {
      pokemon: table(refs.pokemon, POKEMON_REF_FIELDS),
      items: table(refs.items, ITEM_REF_FIELDS, (item) => ({
        ...item,
        sprite: packSprite(item.sprite),
        precioNpc: pack(item.precioNpc, NPC_PRICE_FIELDS),
      })),
      elementos: table(refs.elementos, ELEMENT_REF_FIELDS, (element) => ({
        ...element,
        icono: packSprite(element.icono),
      })),
      auras: table(refs.auras, AURA_REF_FIELDS, (aura) => ({
        ...aura,
        icono: packSprite(aura.icono),
      })),
      addons: Object.entries(refs.addons),
      mundos: Object.entries(refs.mundos),
      vendedores: table(refs.vendedores, SELLER_REF_FIELDS),
    },
  };
}

// ----------------------------------------------------------------------------- reading

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

/** A value that is not the data of 9.5: the list controller reports it as not loaded (PR5). */
function fail(what: string): never {
  throw new Error(`comercio/datos.json: ${what}`);
}

/**
 * The fields the build wrote (`encodeTradeData`). The decoder checks the shape (lists of the
 * right length, the fields every view reads) and trusts the values, as it trusts the rest of
 * the build's output.
 */
function trusted<T>(fields: Record<string, unknown>): T {
  return fields as T;
}

/** A list of `fields.length` values as an object with those fields; anything else throws. */
function unpack(value: unknown, fields: readonly string[], what: string): Record<string, unknown> {
  if (!Array.isArray(value) || value.length !== fields.length) return fail(what);
  return Object.fromEntries(fields.map((field, index) => [field, value[index]]));
}

function listOf<T>(value: unknown, read: (entry: unknown) => T, what: string): T[] {
  if (!Array.isArray(value)) return fail(what);
  return value.map((entry) => read(entry));
}

function readSprite(value: unknown, what: string): SpriteData | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length < 4 || value.length > 5) return fail(what);
  const [src, size, frames, mode, rest] = value as unknown[];
  if (typeof src !== 'string' || !Array.isArray(size) || typeof frames !== 'number') {
    return fail(what);
  }
  return trusted<SpriteData>({ src, size, frames, mode, ...(isRecord(rest) ? rest : {}) });
}

function readPrice(value: unknown): Precio {
  const price = unpack(value, PRICE_FIELDS, 'precio');
  return {
    real:
      price.real === null ? null : trusted<PrecioReal>(unpack(price.real, REAL_FIELDS, 'precio')),
    juego: listOf(
      price.juego,
      (option) => trusted<OpcionJuego>(unpack(option, OPTION_FIELDS, 'precio')),
      'precio',
    ),
    aConvenir: price.aConvenir === true,
  };
}

function readNpc(value: unknown): PrecioNpc | null {
  if (value === null) return null;
  const { tipo, cantidad } = unpack(value, NPC_FIELDS, 'precioNpc');
  if (tipo === 'unsellable') return { tipo };
  if (tipo === 'pokedolares' && typeof cantidad === 'number') return { tipo, cantidad };
  return fail('precioNpc');
}

function readUnit(value: unknown): UnidadPokemon | null {
  if (value === null) return null;
  const unit = unpack(value, UNIT_FIELDS, 'pokemon');
  if (!isText(unit.pokemon)) return fail('pokemon');
  return {
    ...trusted<UnidadPokemon>(unit),
    ball:
      unit.ball === null ? null : trusted<BallDeclarada>(unpack(unit.ball, BALL_FIELDS, 'ball')),
    memorias: listOf(unit.memorias, (id) => (isText(id) ? id : null), 'memorias'),
    helds: listOf(
      unit.helds,
      (held) => trusted<HeldDeclarado>(unpack(held, HELD_FIELDS, 'helds')),
      'helds',
    ),
    addon:
      unit.addon === null
        ? null
        : trusted<AddonDeclarado>(unpack(unit.addon, ADDON_FIELDS, 'addon')),
    entrenamiento: listOf(
      unit.entrenamiento,
      (entry) => trusted<EntrenamientoDeclarado>(unpack(entry, TRAINING_FIELDS, 'entrenamiento')),
      'entrenamiento',
    ),
    precioNpc: readNpc(unit.precioNpc),
  };
}

/** A row of `filas`, read by the names of `campos` (PR5). */
function readRow(fila: unknown, columns: readonly (readonly [string, number])[]): TradeListing {
  if (!Array.isArray(fila)) return fail('a row is not a list');
  const row: Record<string, unknown> = {};
  for (const [field, index] of columns) row[field] = index < 0 ? undefined : fila[index];
  const { id, tipo, vendedor, mundo, publicado, expira, estado, cantidad, item } = row;
  if (
    !isText(id) ||
    !TIPOS_ACTIVO.includes(tipo as TipoActivo) ||
    !isText(vendedor) ||
    !isText(mundo) ||
    !isText(publicado) ||
    !isText(expira) ||
    !ESTADOS_ANUNCIO.includes(estado as EstadoAnuncio)
  ) {
    return fail(`bad row «${String(id)}»`);
  }
  return {
    id,
    tipo: tipo as TipoActivo,
    vendedor,
    mundo,
    publicado,
    expira,
    estado: estado as EstadoAnuncio,
    precio: readPrice(row.precio),
    pokemon: readUnit(row.pokemon ?? null),
    item:
      item === null || item === undefined
        ? null
        : trusted<ItemDeclarado>(unpack(item, ITEM_FIELDS, 'item')),
    cantidad: typeof cantidad === 'number' ? cantidad : null,
  };
}

/** A table of `refs`: its entries by id. */
function readTable<T>(
  value: unknown,
  fields: readonly string[],
  what: string,
  read: (fields: Record<string, unknown>) => T,
): Record<string, T> {
  return Object.fromEntries(
    listOf(
      value,
      (entry) => {
        const { id, ...rest } = unpack(entry, fields, what);
        if (!isText(id)) return fail(what);
        return [id, read(rest)] as const;
      },
      what,
    ),
  );
}

function readName(fields: Record<string, unknown>): string {
  return isText(fields.nombre) ? fields.nombre : fail('refs: nombre');
}

function readRefs(value: unknown): TradeRefs {
  if (!isRecord(value)) return fail('refs');
  return {
    pokemon: readTable(value.pokemon, POKEMON_REF_FIELDS, 'refs.pokemon', (ref) =>
      trusted<TradePokemonRef>(ref),
    ),
    items: readTable(value.items, ITEM_REF_FIELDS, 'refs.items', (ref) => ({
      ...trusted<TradeItemRef>(ref),
      sprite: readSprite(ref.sprite, 'refs.items'),
      precioNpc: trusted<TradeItemRef['precioNpc']>(
        unpack(ref.precioNpc, NPC_PRICE_FIELDS, 'refs.items'),
      ),
    })),
    elementos: readTable(value.elementos, ELEMENT_REF_FIELDS, 'refs.elementos', (ref) => ({
      ...trusted<TradeElementRef>(ref),
      icono: readSprite(ref.icono, 'refs.elementos'),
    })),
    auras: readTable(value.auras, AURA_REF_FIELDS, 'refs.auras', (ref) => ({
      ...trusted<TradeAuraRef>(ref),
      icono: readSprite(ref.icono, 'refs.auras'),
    })),
    addons: readTable(value.addons, NAME_FIELDS, 'refs.addons', readName),
    mundos: readTable(value.mundos, NAME_FIELDS, 'refs.mundos', readName),
    vendedores: readTable(value.vendedores, SELLER_REF_FIELDS, 'refs.vendedores', (ref) => ({
      ...trusted<TradeSellerRef>(ref),
      presencia: ESTADOS_PRESENCIA.find((estado) => estado === ref.presencia) ?? null,
    })),
  };
}

/** The names the title and the search read (9.4, 9.5.2), from the tables of `refs`. */
function refNames(refs: TradeRefs): ListingNames {
  const lookup =
    <T,>(table: Readonly<Record<string, T>>, name: (entry: T) => string) =>
    (id: string) =>
      Object.hasOwn(table, id) ? name(table[id]) : undefined;
  return {
    pokemon: lookup(refs.pokemon, (ref) => ref.nombre),
    item: lookup(refs.items, (ref) => ref.nombre),
    addon: lookup(refs.addons, (nombre) => nombre),
    aura: lookup(refs.auras, (ref) => ref.nombre),
    mundo: lookup(refs.mundos, (nombre) => nombre),
    vendedor: lookup(refs.vendedores, (ref) => ref.nombre),
  };
}

/** A listing with its title and its search text (9.4, 9.5.2). */
function withText(listing: TradeListing, locale: Locale, names: ListingNames): TradeRow {
  const input = {
    ...listing,
    pokemon: listing.pokemon ?? undefined,
    item: listing.item ?? undefined,
    cantidad: listing.cantidad ?? undefined,
  };
  const title = listingTitle(input, locale, names);
  return {
    ...listing,
    titulo: title.texto,
    accesible: title.accesible,
    busqueda: searchText(input, locale, names),
  };
}

/**
 * The records of a `TradeData` (the props, or `datos.json`), each row read by the names of
 * `campos` and given its title and search text in the page's language. A missing column or a
 * value of the wrong kind throws, and the list controller then reports the data as not loaded
 * (PR5).
 */
export function decodeTradeData(data: unknown, locale: Locale): TradeRecords {
  const file = isRecord(data) ? data : null;
  const campos = file?.campos;
  const filas = file?.filas;
  if (file === null || file.v !== 1 || !Array.isArray(campos) || !Array.isArray(filas)) {
    return fail('unknown shape');
  }
  const refs = readRefs(file.refs);
  const names = refNames(refs);
  const columns = TRADE_FIELDS.map((field) => [field, campos.indexOf(field)] as const);
  return {
    rows: filas.map((fila: unknown) => withText(readRow(fila, columns), locale, names)),
    refs,
  };
}

// ------------------------------------------------------------------------ the build side
//
// What the build writes into the props and into `/{l}/comercio/datos.json` (PR5), and what the
// detail and the profile read, from the registries the page reads on the server. The registries
// arrive as arguments and this module imports none of them, so Zod and the file system stay out
// of the island (AGENTS.md); only the build calls `tradeRecords` and `tradeData`.

/** The registries a Comercio page reads for its rows, as src/lib/content/ gives them. */
export interface TradeCatalog {
  pokemon: readonly PokemonRecord[];
  items: readonly Item[];
  categorias: readonly Categoria[];
  elementos: readonly Elemento[];
  auras: readonly Aura[];
  outfits: readonly OutfitRecord[];
  mundos: readonly Mundo[];
  vendedores: readonly Vendedor[];
  sprites: SpriteRegistry;
  /** `trade.channels` of the page's dictionary: the public label of each channel (9.9). */
  channels: ChannelLabels;
}

/**
 * The fixed sprites of 9.5.1 through the adapter (DP2): each tab and group, the stages of
 * Diamonds and Pokédólares — the Diamond turns in Comercio (7.8) — and `ui/comercio/item`. A key
 * the owner has not added yet is `null` (FIXED_SPRITE_KEYS) and draws the missing mark.
 */
export function tradeSprites(registry: SpriteRegistry): TradeSprites {
  return {
    types: {
      pokemon: spriteOrNull(registry, 'outfits/5'),
      items: spriteOrNull(registry, 'items/stones/fire-stone'),
      diamonds: spriteOrNull(registry, 'ui/diamond', { animado: true }),
      pokedolares: spriteOrNull(registry, 'ui/pokedolares'),
    },
    item: spriteOrNull(registry, 'ui/comercio/item'),
  };
}

/** Where a skill goes among the declared ones: the order of the form and of the card (9.4). */
const SKILL_ORDER = new Map<string, number>(HABILIDADES.map((skill, index) => [skill, index]));

/**
 * The records of `anuncios`, in their order, and what they name (PR5): a list's first page, its
 * whole list, a seller's listings or the one listing of a detail. The Pokémon of a Ditto Memory
 * and the addons are named too: the search reads their names (9.5.2) and the detail links the
 * memories (9.6). The title and the search text come from the names of `refs`, as
 * `decodeTradeData` writes them in the browser.
 */
export function tradeRecords(
  anuncios: readonly Anuncio[],
  catalog: TradeCatalog,
  locale: Locale,
): TradeRecords {
  const pokemonById = new Map(catalog.pokemon.map((record) => [record.id, record]));
  const itemById = new Map(catalog.items.map((item) => [item.id, item]));
  const categoryName = new Map(catalog.categorias.map((entry) => [entry.id, entry.nombre[locale]]));
  const elementById = new Map(catalog.elementos.map((element) => [element.id, element]));
  const auraById = new Map(catalog.auras.map((aura) => [aura.id, aura]));
  const addonById = new Map(
    catalog.outfits.flatMap((outfit) => outfit.addons.map((addon) => [addon.id, addon] as const)),
  );
  const worldName = new Map(catalog.mundos.map((world) => [world.id, world.nombre]));
  const sellerById = new Map(catalog.vendedores.map((seller) => [seller.id, seller]));
  const sprite = (key: string | null) => spriteOrNull(catalog.sprites, key);

  const listings: TradeListing[] = anuncios.map((anuncio) => {
    const unit = anuncio.pokemon;
    return {
      id: anuncio.id,
      tipo: anuncio.tipo,
      vendedor: anuncio.vendedor,
      mundo: anuncio.mundo,
      publicado: anuncio.publicado,
      expira: anuncio.expira,
      estado: anuncio.estado,
      precio: anuncio.precio,
      pokemon:
        unit === undefined
          ? null
          : {
              ...unit,
              entrenamiento: [...unit.entrenamiento].sort(
                (a, b) => (SKILL_ORDER.get(a.habilidad) ?? 0) - (SKILL_ORDER.get(b.habilidad) ?? 0),
              ),
            },
      item: anuncio.item ?? null,
      cantidad: anuncio.cantidad ?? null,
    };
  });

  // What the rows name, once each.
  const pokemonIds = new Set<string>();
  const itemIds = new Set<string>();
  const auraIds = new Set<string>();
  const addonIds = new Set<string>();
  for (const listing of listings) {
    const unit = listing.pokemon;
    if (unit !== null) {
      pokemonIds.add(unit.pokemon);
      for (const id of unit.memorias) if (id !== null) pokemonIds.add(id);
      if (unit.ball?.item) itemIds.add(unit.ball.item);
      for (const held of unit.helds) if (held.item !== null) itemIds.add(held.item);
      if (unit.aura !== null) auraIds.add(unit.aura);
      if (unit.addon?.id) addonIds.add(unit.addon.id);
    }
    if (listing.item?.item) itemIds.add(listing.item.item);
  }

  const items: Record<string, TradeItemRef> = {};
  const elementIds = new Set<string>();
  for (const id of itemIds) {
    const item = itemById.get(id);
    if (item === undefined) continue;
    // «Drop de» (7.5.3): the Pokémon whose `drops` hold the item, in the order of 8.0.5.
    const droppers = catalog.pokemon
      .filter((record) => record.drops?.some((drop) => drop.item === id))
      .sort(pokedexOrder(locale));
    const dropper = droppers.length === 1 ? droppers[0].id : null;
    if (dropper !== null) pokemonIds.add(dropper);
    if (item.elemento) elementIds.add(item.elemento);
    items[id] = {
      nombre: item.nombre,
      categoria: item.categoria,
      nombreCategoria: categoryName.get(item.categoria) ?? null,
      sprite: sprite(item.sprite),
      precioNpc: item.precioNpc,
      elemento: item.elemento ?? null,
      uso: item.uso?.[locale] ?? null,
      dropDe: droppers.map((record) => record.nombre),
      dropper,
    };
  }

  const pokemon: Record<string, TradePokemonRef> = {};
  for (const id of pokemonIds) {
    const record = pokemonById.get(id);
    if (record === undefined) continue;
    for (const element of record.elementos) elementIds.add(element);
    pokemon[id] = {
      nombre: record.nombre,
      variante: record.variante,
      nivel: record.nivel,
      tier: record.tier,
      generacion: record.generacion,
      funcion: record.funcion,
      elementos: record.elementos,
      imagen: record.imagen,
    };
  }

  const elementos: Record<string, TradeElementRef> = {};
  for (const id of elementIds) {
    const element = elementById.get(id);
    if (element === undefined) continue;
    const stone = element.stone === null ? undefined : itemById.get(element.stone);
    const fragment = element.fragment === null ? undefined : itemById.get(element.fragment);
    elementos[id] = {
      nombre: element.nombre[locale],
      icono: sprite(element.icono),
      stone: stone?.nombre ?? null,
      fragment: fragment?.nombre ?? null,
    };
  }

  const auras: Record<string, TradeAuraRef> = {};
  for (const id of auraIds) {
    const aura = auraById.get(id);
    if (aura !== undefined) auras[id] = { nombre: aura.nombre, icono: sprite(aura.icono) };
  }

  const addons: Record<string, string> = {};
  for (const id of addonIds) {
    const addon = addonById.get(id);
    if (addon !== undefined) addons[id] = addon.nombre;
  }

  const mundos: Record<string, string> = {};
  const vendedores: Record<string, TradeSellerRef> = {};
  for (const listing of listings) {
    const world = worldName.get(listing.mundo);
    if (world !== undefined) mundos[listing.mundo] = world;
    const seller = sellerById.get(listing.vendedor);
    if (seller === undefined || Object.hasOwn(vendedores, seller.id)) continue;
    const reputation = sellerReputation(seller.resenas);
    vendedores[seller.id] = {
      nombre: seller.nombre,
      valoracion: reputation.valoracion,
      resenas: reputation.resenas,
      canales: seller.canales.map((canal) => channelLabel(canal, catalog.channels)),
      presencia: seller.presencia,
    };
  }

  const refs: TradeRefs = { pokemon, items, elementos, auras, addons, mundos, vendedores };
  const names = refNames(refs);
  return { rows: listings.map((listing) => withText(listing, locale, names)), refs };
}

/**
 * `tradeRecords` as PR5 carries them: the props of the island (the page writes them as one
 * JSON text, see `TradeListRootProps.data`) and `/{l}/comercio/datos.json`.
 */
export function tradeData(
  anuncios: readonly Anuncio[],
  catalog: TradeCatalog,
  locale: Locale,
): TradeData {
  return encodeTradeData(tradeRecords(anuncios, catalog, locale));
}

// ------------------------------------------------------------------------------ routes

/** The detail of a listing (§9.3, 9.6). */
export function listingHref(locale: Locale, id: string): string {
  return `/${locale}/comercio/anuncio/${id}/`;
}

/** The profile of a seller (§9.3, 9.8). */
export function sellerHref(locale: Locale, handle: string): string {
  return `/${locale}/comercio/vendedor/${handle}/`;
}

/** The form of phase A, «Crear anuncio» (§9.3, 9.7). */
export function publishHref(locale: Locale): string {
  return `/${locale}/comercio/publicar/`;
}

// ------------------------------------------------------------------------------ config

/** The score of a seller for the orders and the «Valoración» filter (9.5.4, 9.5.5). */
function scoresOf(refs: TradeRefs): (handle: string) => SellerScore | null {
  return (handle) => (Object.hasOwn(refs.vendedores, handle) ? refs.vendedores[handle] : null);
}

/** The online status of the seller of a row (9.15.6), or `null` for a seller the refs lack. */
function presenceOf(refs: TradeRefs): (row: Pick<TradeRow, 'vendedor'>) => EstadoPresencia | null {
  return (row) =>
    Object.hasOwn(refs.vendedores, row.vendedor) ? refs.vendedores[row.vendedor].presencia : null;
}

/** The value of the filter «Solo en el juego» in the URL (U3): the id of the status. */
export const IN_GAME: EstadoPresencia = 'en_juego';

/** The amount of a listing in `currency`, as stored, or `null` when it has none (9.5.4). */
function amountIn(precio: Precio, currency: PriceCurrency): number | null {
  if (precio.aConvenir) return null;
  if (precio.real !== null && precio.real.moneda === currency) {
    const value = Number(precio.real.importe);
    return Number.isFinite(value) ? value : null;
  }
  const option = precio.juego.find((entry) => entry.tipo === currency);
  return option === undefined ? null : option.cantidad;
}

/**
 * An end of «Precio» (9.5.4): it applies to the amount in the chosen currency, with no
 * conversion, and only with a currency chosen; with «Todas» it takes no value, so U4 drops it
 * from the URL. An end that does not read as an amount of that currency does not filter.
 */
function priceFilter(
  key: 'min' | 'max',
  currency: PriceCurrency | null,
  locale: Locale,
): ListFilter<TradeRow> {
  return {
    key,
    values: currency === null ? [] : 'text',
    test: (row, value) => {
      if (currency === null) return true;
      const bound = parsePrice(value, currency, locale);
      if (bound === null) return true;
      const amount = amountIn(row.precio, currency);
      if (amount === null) return false;
      return key === 'min' ? amount >= bound : amount <= bound;
    },
  };
}

interface TradeConfigInput {
  variant: 'market' | 'seller';
  locale: Locale;
  /** The ids of «Mundo», in the order of content/mundos.json. */
  worlds: readonly string[];
  /** The currency of the URL: the price range reads it. */
  currency: PriceCurrency | null;
  refs: TradeRefs;
  /** Option texts of `SortSelect` (DP1). */
  sorts: Record<ListingOrder, string>;
  dataUrl?: string;
}

/**
 * The `ListConfig` of 9.5.7 (`comercio`) and of the profile (`comercio-vendedor`, 9.8):
 * 24 rows a page; the text of `q`; the filters `tipo`, `mundo`, `moneda`, `min`, `max`, `val`
 * and `presencia` («Solo en el juego», 9.15.6), whose values are ids (U3); the three orders of
 * 9.5.5, from src/lib/trade/sort.ts, the default one with the sellers «En el juego» first
 * (9.15.6); groups by type in the fixed order (R4). The profile keeps the groups and the first
 * order, where every listing has the one seller, and has no filter.
 */
export function tradeConfig({
  variant,
  locale,
  worlds,
  currency,
  refs,
  sorts,
  dataUrl,
}: TradeConfigInput): ListConfig<TradeRow> {
  const scores = scoresOf(refs);
  const base = {
    pageSize: TRADE_PAGE_SIZE,
    groupBy: (row: TradeRow) => row.tipo,
    groupOrder: TIPOS_ACTIVO,
    anchorId: (row: TradeRow) => `anuncio-${row.id}`,
  };
  if (variant === 'seller') {
    return {
      ...base,
      id: 'comercio-vendedor',
      sorts: [{ id: 'recientes', label: sorts.recientes, compare: listingComparator('recientes') }],
      filters: [],
    };
  }
  const presence = presenceOf(refs);
  return {
    ...base,
    id: 'comercio',
    sorts: LISTING_ORDERS.map((id) => ({
      id,
      label: sorts[id],
      compare:
        id === 'recientes'
          ? inGameFirst(presence, listingComparator(id, scores))
          : listingComparator(id, scores),
    })),
    filters: [
      { key: 'tipo', values: TIPOS_ACTIVO, test: (row, value) => row.tipo === value },
      { key: 'mundo', values: worlds, test: (row, value) => row.mundo === value },
      // A listing «A convenir» has no price in any currency: only «Todas» shows it (9.5.4).
      {
        key: 'moneda',
        values: TRADE_CURRENCIES,
        test: (row, value) => amountIn(row.precio, value as PriceCurrency) !== null,
      },
      priceFilter('min', currency, locale),
      priceFilter('max', currency, locale),
      // A seller without reviews has no score to reach (9.5.4).
      {
        key: 'val',
        values: RATING_FLOORS,
        test: (row, value) => {
          const score = scores(row.vendedor);
          return (
            score !== null &&
            score.resenas > 0 &&
            score.valoracion !== null &&
            score.valoracion >= Number(value)
          );
        },
      },
      { key: 'presencia', values: [IN_GAME], test: (row, value) => presence(row) === value },
    ],
    text: (row) => row.busqueda,
    dataUrl,
  };
}

// ----------------------------------------------------------------------- view models

/** `{ es: text }` as the `Texto` a tip builder reads: the name in the page's language only. */
function localized<T>(locale: Locale, value: T): Record<Locale, T> {
  return { [locale]: value } as Record<Locale, T>;
}

/** A plural or a plain template, filled with the figure already formatted (13.2, 13.3). */
function counted(template: MessageLeaf, n: number, locale: Locale): string {
  const chosen = isPluralMessage(template) ? plural(locale, n, template) : template;
  return fill(chosen, { n: formatInteger(n, locale) });
}

/** A sprite sheet in `cantidad` mode shows the frame of the stack it stands for (9.7.3). */
function withQuantity(sprite: SpriteData, quantity: number | null | undefined): SpriteProps {
  if (sprite.mode !== 'cantidad' || quantity === null || quantity === undefined) return sprite;
  return { ...sprite, quantity };
}

function pokemonRef(row: TradeRow, context: TradeContext): TradePokemonRef | null {
  const id = row.pokemon?.pokemon;
  return id !== undefined && Object.hasOwn(context.refs.pokemon, id)
    ? context.refs.pokemon[id]
    : null;
}

function itemRef(id: string | null | undefined, context: TradeContext): TradeItemRef | null {
  return id !== null && id !== undefined && Object.hasOwn(context.refs.items, id)
    ? context.refs.items[id]
    : null;
}

/** The stack count of a stage: the quantity of an items or a Diamonds listing (9.5.8). */
function stackOf(row: TradeRow): number | undefined {
  if (row.tipo === 'items') return row.item?.cantidad;
  if (row.tipo === 'diamonds') return row.cantidad ?? undefined;
  return undefined;
}

/**
 * The picture of a listing (9.5.8, 9.5.9): the art of the Pokémon (smooth), the item's sprite
 * with the frame of its stack or `ui/comercio/item` for an item the registry does not know,
 * the turning Diamond, or the Pokédólares. `null` draws the missing mark (7.4.4).
 */
export function listingSprite(row: TradeRow, context: TradeContext): SpriteProps | null {
  switch (row.tipo) {
    case 'pokemon': {
      const src = resolvePokemonImage(pokemonRef(row, context)?.imagen);
      return src === null ? null : { src, smooth: true };
    }
    case 'items': {
      const ref = itemRef(row.item?.item, context);
      const sprite = ref === null ? context.sprites.item : ref.sprite;
      return sprite === null ? null : withQuantity(sprite, row.item?.cantidad);
    }
    default:
      return context.sprites.types[row.tipo];
  }
}

/** Whether the listed Pokémon is a Shiny variant (8.0.5). */
function isShiny(row: TradeRow, context: TradeContext): boolean {
  return pokemonRef(row, context)?.variante === 'shiny';
}

/** The chip of an element with its panel (7.5.3); `null` for an id the refs do not carry. */
function elementEntry(id: string, context: TradeContext): ElementChipEntry | null {
  if (!Object.hasOwn(context.refs.elementos, id)) return null;
  const ref = context.refs.elementos[id];
  return {
    id,
    name: ref.nombre,
    icon: ref.icono,
    tip: elementTip(
      { ...ref, id, nombre: localized(context.locale, ref.nombre) },
      context.locale,
      context.ui.tooltip,
    ),
  };
}

/** The panel of an item of the registry (7.5.3). */
export function itemPanel(id: string, ref: TradeItemRef, context: TradeContext): TipData {
  const { locale } = context;
  const element =
    ref.elemento !== null && Object.hasOwn(context.refs.elementos, ref.elemento)
      ? context.refs.elementos[ref.elemento].nombre
      : null;
  return itemTip(
    {
      id,
      nombre: ref.nombre,
      categoria: ref.categoria,
      sprite: ref.sprite,
      precioNpc: ref.precioNpc,
      nombreCategoria: ref.nombreCategoria === null ? null : localized(locale, ref.nombreCategoria),
      dropDe: ref.dropDe,
      nombreElemento: element === null ? null : localized(locale, element),
      uso: ref.uso === null ? null : localized(locale, ref.uso),
    },
    locale,
    context.ui.tooltip,
  );
}

/** The panel of a Pokémon of the registry (7.5.3): a memory, the one Pokémon of «Drop de». */
export function pokemonPanel(id: string, ref: TradePokemonRef, context: TradeContext): TipData {
  const { locale } = context;
  const elementos = ref.elementos.flatMap((element) =>
    Object.hasOwn(context.refs.elementos, element)
      ? [{ nombre: localized(locale, context.refs.elementos[element].nombre) }]
      : [],
  );
  return pokemonTip({ id, ...ref, elementos }, locale, context.ui.tooltip);
}

/**
 * An entity a listing declares (a Ball, 9.4): the registry's name, sprite and panel when the
 * declared name matched a record; otherwise the declared name as text, with neither panel nor
 * sprite (R2).
 */
function declaredEntity(
  id: string | null,
  nombre: string,
  context: TradeContext,
): ListingCardEntity | string {
  const ref = itemRef(id, context);
  if (ref === null || id === null) return nombre;
  return { name: ref.nombre, sprite: ref.sprite, tip: itemPanel(id, ref, context) };
}

/** «Drop de» of an item (7.5.3): its one Pokémon with its page and panel, «{n} Pokémon», or nothing. */
function droppedBy(ref: TradeItemRef, context: TradeContext): ListingFactValue {
  if (ref.dropDe.length === 0) return null;
  if (ref.dropDe.length > 1) {
    return counted(context.labels.droppedByCount, ref.dropDe.length, context.locale);
  }
  const id = ref.dropper;
  if (id === null || !Object.hasOwn(context.refs.pokemon, id)) return ref.dropDe[0];
  const pokemon = context.refs.pokemon[id];
  return {
    name: pokemon.nombre,
    href: `/${context.locale}/pokedex/${id}/`,
    tip: pokemonPanel(id, pokemon, context),
  };
}

/** The NPC Price a Pokémon declares (9.4): «Unsellable», an amount, or nothing. */
function npcPrice(
  precio: UnidadPokemon['precioNpc'],
  context: TradeContext,
): string | number | null {
  if (precio === null) return null;
  return precio.tipo === 'unsellable' ? context.labels.unsellable : precio.cantidad;
}

/** The facts of a card by key (9.5.8), in the shapes `ListingCard` draws. */
function listingFacts(
  row: TradeRow,
  context: TradeContext,
): Partial<Record<ListingKey, ListingFactValue>> {
  const { locale } = context;
  if (row.tipo === 'pokemon' && row.pokemon !== null) {
    const unit = row.pokemon;
    const pokemon = pokemonRef(row, context);
    const elements = (pokemon?.elementos ?? []).flatMap((id) => elementEntry(id, context) ?? []);
    return {
      requirement: levelText(pokemon, context),
      tier: tierText(pokemon),
      elements,
      ball: unit.ball === null ? null : declaredEntity(unit.ball.item, unit.ball.nombre, context),
      aura: auraRef(unit.aura, context)?.nombre ?? null,
      boost: unit.boost === null ? null : formatSigned(unit.boost, locale),
      nickname: unit.nickname,
      memorySlots: unit.memorySlots,
      starLevel: unit.starLevel,
      npcPrice: npcPrice(unit.precioNpc, context),
    };
  }
  if (row.tipo === 'items' && row.item !== null) {
    const ref = itemRef(row.item.item, context);
    return {
      quantity: row.item.cantidad,
      category: ref?.nombreCategoria ?? null,
      element: ref?.elemento ? elementEntry(ref.elemento, context) : null,
      use: ref?.uso ?? null,
      droppedBy: ref === null ? null : droppedBy(ref, context),
    };
  }
  if (row.tipo === 'diamonds') {
    return {
      quantity: row.cantidad,
      boughtAt: context.diamonds?.seCompranEn ?? null,
      usedFor: context.diamonds?.seUsanEn ?? null,
    };
  }
  return { quantity: row.cantidad };
}

/** A panel with nothing below its title: its mention stays text (R2, `HeldStrip`). */
function bareTip(name: string): TipData {
  return {
    key: `item:${name}`,
    title: name,
    width: 300,
    head: { type: 'sprite', sprite: null },
    rows: [],
  };
}

/** The held items of a Pokémon (9.5.8): «X-Attack T5», each with its panel when it has one. */
function heldItems(unit: UnidadPokemon, context: TradeContext): ListingCardListing['helds'] {
  return unit.helds.map((held) => {
    const ref = itemRef(held.item, context);
    const name = ref?.nombre ?? held.nombre;
    return {
      name,
      tier: formatTier(held.tier),
      sprite: ref?.sprite ?? null,
      // R2: a declared name without a registry match opens nothing.
      tip: ref !== null && held.item !== null ? itemPanel(held.item, ref, context) : bareTip(name),
    };
  });
}

/** Requisito, «Nivel 120» (13.3), or `null` while the record has no level. */
function levelText(pokemon: TradePokemonRef | null, context: TradeContext): string | null {
  const level = pokemon?.nivel;
  if (level === null || level === undefined) return null;
  return fill(context.ui.tooltip.level, { n: formatInteger(level, context.locale) });
}

/** Tier, «T3» or «Legendary» (8.0.5), or `null` while the record has none. */
function tierText(pokemon: TradePokemonRef | null): string | null {
  const tier = pokemon?.tier;
  return tier === null || tier === undefined ? null : formatTier(tier);
}

/** The aura's name of the registry (9.5.8), or `null`. */
function auraRef(id: string | null, context: TradeContext): TradeAuraRef | null {
  return id !== null && Object.hasOwn(context.refs.auras, id) ? context.refs.auras[id] : null;
}

/**
 * Next Boost chance (9.4): «0» to «100» with up to 2 decimals as declared, written with the
 * decimals the seller typed («12,5%»), or `null`.
 */
function chanceText(value: string | null, locale: Locale): string | null {
  if (value === null) return null;
  const chance = Number(value);
  if (!Number.isFinite(chance)) return null;
  const decimals = (value.split(/[.,]/)[1] ?? '').length;
  return formatPercent(chance, locale, { decimals });
}

/** A declared training with both its level and its progress: the one a meter can draw. */
function trainingOf(entry: UnidadPokemon['entrenamiento'][number]): TipTraining | null {
  if (entry.nivel === null || entry.progreso === null) return null;
  const percent = Number(entry.progreso);
  return Number.isFinite(percent) ? { stat: entry.habilidad, level: entry.nivel, percent } : null;
}

/** The real price as the page writes it («R$ 90», 13.3), or `null`. */
function fiatText(precio: Precio, locale: Locale): string | null {
  if (precio.real === null) return null;
  const value = Number(precio.real.importe);
  return Number.isFinite(value) ? formatRealMoney(value, precio.real.moneda, locale) : null;
}

/** The in-game options of a price, in the seller's order (PriceOptions). */
function gameOptions(precio: Precio): PriceOption[] {
  return precio.juego.map((option) => ({
    kind: option.tipo === 'pokedolares' ? 'pd' : 'dia',
    amount: option.cantidad,
  }));
}

/**
 * The price a screen reader hears after the title of a slot (9.5.8): the real money; without
 * it, the in-game options joined by «o», each with its exact figure («150.000.000 Pokédólares o
 * 400 Diamonds»); without them, «A convenir».
 */
export function priceLabel(row: TradeRow, context: TradeContext): string {
  const fiat = fiatText(row.precio, context.locale);
  if (fiat !== null) return fiat;
  if (row.precio.juego.length > 0) {
    return row.precio.juego
      .map((option) =>
        option.tipo === 'pokedolares'
          ? formatPokedolaresLabel(option.cantidad, context.locale)
          : formatDiamonds(option.cantidad, context.locale),
      )
      .join(` ${context.ui.or} `);
  }
  return context.labels.card.negotiable;
}

/** A seller's online status with its label (9.15.6), or `null` for a seller without one. */
export function sellerPresence(
  seller: Pick<TradeSellerRef, 'presencia'> | null,
  context: Pick<TradeContext, 'labels'>,
): SellerPresenceData | null {
  const state = seller?.presencia ?? null;
  return state === null ? null : { state, label: context.labels.presence[state] };
}

/** A listing as `ListingCard` reads it (9.5.8). `posted` is the text of its `<time>`. */
export function listingCard(
  row: TradeRow,
  context: TradeContext,
  posted: string,
): ListingCardListing {
  const { locale, refs } = context;
  const seller = Object.hasOwn(refs.vendedores, row.vendedor)
    ? refs.vendedores[row.vendedor]
    : null;
  const first = row.pokemon?.entrenamiento[0];
  return {
    type: row.tipo,
    title: row.titulo,
    titleAccessible: row.accesible,
    href: listingHref(locale, row.id),
    sprite: listingSprite(row, context),
    qty: stackOf(row),
    shiny: isShiny(row, context),
    world: Object.hasOwn(refs.mundos, row.mundo) ? refs.mundos[row.mundo] : null,
    posted: { datetime: row.publicado, text: posted },
    reserved: row.estado === 'reservado',
    facts: listingFacts(row, context),
    helds: row.pokemon === null ? null : heldItems(row.pokemon, context),
    train: first === undefined ? null : trainingOf(first),
    fiat: fiatText(row.precio, locale),
    game: gameOptions(row.precio),
    negotiable: row.precio.aConvenir,
    seller:
      seller === null
        ? null
        : {
            name: seller.nombre,
            href: sellerHref(locale, row.vendedor),
            score: seller.valoracion,
            reviews: seller.resenas,
            presence: sellerPresence(seller, context),
          },
    channels: seller?.canales ?? null,
  };
}

/** The value of a panel row, or nothing (T32: a row with no value is dropped). */
function tipText(value: string | null | undefined): TipValue | null {
  return present(value) ? (value as string) : null;
}

/** Extra rows of the fixed sheet of a detail page (9.6), which a popover panel does not carry. */
export interface ListingSheetLabels {
  /** «Addon». */
  addon: string;
  /** «Next Boost chance», a game term. */
  nextBoostChance: string;
}

/**
 * The panel of a listing (9.5.9, `listingTip` of 7.5.3): 282 wide in two columns. Its head is
 * the art of the Pokémon with its aura ball and the Shiny mark, or the asset's sprite at 2x
 * (the Diamond turns); its title the nickname, or the listing's title. The rows are the card's
 * keys that have a value — «Pokémon:» first when the nickname is the title — then «Held Items:
 * N» and «Entrenamiento: N» as sections, and the market block: «Dinero real:», «En el juego:»,
 * «Mundo:», «Vendedor:» and «Contacto:» with the public labels of the channels, never a value
 * (CA-9.9).
 *
 * With `sheet` it is the fixed sheet of the detail (9.6): the same head and rows plus «Addon:»
 * and «Next Boost chance:», every held item, no training section (the page draws every trained
 * skill under the sheet, beside the Ditto Memory links a section of `TipData` cannot hold) and
 * no market block.
 */
export function listingTip(
  row: TradeRow,
  context: TradeContext,
  sheet?: ListingSheetLabels,
): TipData {
  const { locale, refs, ui, labels } = context;
  const keys = labels.card.keys;
  const rows: TipRow[] = [];
  const push = (label: string, value: TipValue | null | undefined) => {
    if (value !== null && value !== undefined) rows.push({ label, value });
  };

  const unit = row.pokemon;
  const pokemon = pokemonRef(row, context);
  const nickname = unit !== null && present(unit.nickname) ? (unit.nickname as string) : null;
  if (nickname !== null) push(labels.types.pokemon, tipText(pokemon?.nombre ?? row.titulo));

  const sections: TipSection[] = [];
  if (row.tipo === 'pokemon' && unit !== null) {
    const elements = (pokemon?.elementos ?? []).flatMap((id) =>
      Object.hasOwn(refs.elementos, id) ? [refs.elementos[id].nombre] : [],
    );
    const ball =
      unit.ball === null ? null : (itemRef(unit.ball.item, context)?.nombre ?? unit.ball.nombre);
    const npc = unit.precioNpc;
    push(keys.requirement, levelText(pokemon, context));
    push(keys.tier, tierText(pokemon));
    // Elements read as one value in a panel: «Fuego / Volador» (8.0.5).
    push(keys.elements, tipText(elements.join(' / ')));
    push(keys.ball, tipText(ball));
    push(keys.aura, auraRef(unit.aura, context)?.nombre ?? null);
    push(keys.boost, unit.boost === null ? null : formatSigned(unit.boost, locale));
    push(keys.nickname, tipText(nickname));
    push(
      keys.memorySlots,
      unit.memorySlots === null ? null : formatInteger(unit.memorySlots, locale),
    );
    push(keys.starLevel, unit.starLevel === null ? null : formatInteger(unit.starLevel, locale));
    push(
      keys.npcPrice,
      npc === null ? null : npc.tipo === 'unsellable' ? labels.unsellable : { pd: npc.cantidad },
    );
    if (sheet !== undefined) {
      push(sheet.addon, tipText(unit.addon?.nombre));
      push(sheet.nextBoostChance, chanceText(unit.nextBoostChance, locale));
    }

    if (unit.helds.length > 0) {
      sections.push({
        kind: 'held',
        label: fill(ui.money.heldItems, { n: formatInteger(unit.helds.length, locale) }),
        items: unit.helds.map((held) => {
          const ref = itemRef(held.item, context);
          return {
            name: `${ref?.nombre ?? held.nombre} ${formatTier(held.tier)}`,
            sprite: ref?.sprite ?? null,
          };
        }),
      });
    }
    // «Entrenamiento: N» with every skill declared, in the order of `Habilidad` (9.5.9). The
    // sheet of a detail draws its own, with the same skills (9.6).
    const trained = unit.entrenamiento.flatMap((entry) => trainingOf(entry) ?? []);
    if (sheet === undefined && trained.length > 0) {
      sections.push({
        kind: 'train',
        label: fill(labels.training, { n: formatInteger(trained.length, locale) }),
        skills: trained,
      });
    }
  } else if (row.tipo === 'items' && row.item !== null) {
    const ref = itemRef(row.item.item, context);
    const element =
      ref?.elemento && Object.hasOwn(refs.elementos, ref.elemento)
        ? refs.elementos[ref.elemento].nombre
        : null;
    const droppers = ref?.dropDe ?? [];
    push(keys.quantity, formatInteger(row.item.cantidad, locale));
    push(keys.category, tipText(ref?.nombreCategoria));
    push(keys.element, tipText(element));
    push(keys.use, tipText(ref?.uso));
    push(
      keys.droppedBy,
      droppers.length === 0
        ? null
        : droppers.length === 1
          ? droppers[0]
          : counted(labels.droppedByCount, droppers.length, locale),
    );
  } else if (row.tipo === 'diamonds') {
    push(keys.quantity, row.cantidad === null ? null : { dia: row.cantidad });
    push(keys.boughtAt, context.diamonds ? { list: [...context.diamonds.seCompranEn] } : null);
    push(keys.usedFor, context.diamonds ? { list: [...context.diamonds.seUsanEn] } : null);
  } else {
    push(keys.quantity, row.cantidad === null ? null : { pd: row.cantidad });
  }

  const market: TipRow[] = [];
  if (sheet === undefined) {
    const seller = Object.hasOwn(refs.vendedores, row.vendedor)
      ? refs.vendedores[row.vendedor]
      : null;
    const fiat = fiatText(row.precio, locale);
    const options = gameOptions(row.precio);
    const pushMarket = (label: string, value: TipValue | null) => {
      if (value !== null) market.push({ label, value });
    };
    // «A convenir» takes the first price row, as on the card (9.5.8).
    pushMarket(labels.card.fiat, fiat ?? (row.precio.aConvenir ? labels.card.negotiable : null));
    pushMarket(labels.card.game, options.length > 0 ? { price: options } : null);
    pushMarket(labels.world, Object.hasOwn(refs.mundos, row.mundo) ? refs.mundos[row.mundo] : null);
    if (seller !== null) {
      const scored = seller.resenas > 0 && seller.valoracion !== null;
      pushMarket(
        labels.card.seller,
        scored
          ? fill(labels.market.sellerValue, {
              name: seller.nombre,
              score: formatRating(seller.valoracion),
              n: formatInteger(seller.resenas, locale),
            })
          : seller.nombre,
      );
      pushMarket(
        labels.market.contact,
        seller.canales.length > 0 ? { list: [...seller.canales] } : null,
      );
    }
  }

  let head: TipHead;
  if (row.tipo === 'pokemon') {
    const aura = auraRef(unit?.aura ?? null, context);
    head = {
      type: 'art',
      src: resolvePokemonImage(pokemon?.imagen),
      ...(aura !== null && aura.icono !== null
        ? { aura: { sprite: aura.icono, label: aura.nombre } }
        : {}),
    };
  } else {
    head = { type: 'sprite', sprite: listingSprite(row, context) };
  }

  return {
    key: `anuncio:${row.id}`,
    title: nickname ?? row.titulo,
    width: 282,
    head,
    ...(isShiny(row, context) ? { shiny: true } : {}),
    rows,
    grid: true,
    ...(sections.length > 0 ? { sections } : {}),
    ...(market.length > 0 ? { market } : {}),
  };
}

/** The title of a listing where it is text of the page: visible and heard forms (9.4, R5). */
export function listingTitleNode(row: Pick<TradeRow, 'titulo' | 'accesible'>): ReactNode {
  if (row.accesible === row.titulo) return row.titulo;
  return (
    <>
      <span aria-hidden="true">{row.titulo}</span>
      <span className="sr-only">{row.accesible}</span>
    </>
  );
}

/**
 * The second line of a Lista name (9.5.8): what a Pokémon declares, «{nickname} · +{boost} ·
 * Memory Slots {n} · Star Level {n}», or the «×{cantidad}» of an item.
 */
function listSub(row: TradeRow, context: TradeContext): string | null {
  const { locale, labels } = context;
  if (row.tipo === 'items' && row.item !== null)
    return `×${formatInteger(row.item.cantidad, locale)}`;
  const unit = row.pokemon;
  if (row.tipo !== 'pokemon' || unit === null) return null;
  const parts: string[] = [];
  if (present(unit.nickname)) parts.push(unit.nickname as string);
  if (unit.boost !== null) parts.push(formatSigned(unit.boost, locale));
  if (unit.memorySlots !== null) {
    parts.push(`${labels.card.keys.memorySlots} ${formatInteger(unit.memorySlots, locale)}`);
  }
  if (unit.starLevel !== null) {
    parts.push(`${labels.card.keys.starLevel} ${formatInteger(unit.starLevel, locale)}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ------------------------------------------------------------------------------ clock

const MINUTE_MS = 60_000;

function subscribeMinute(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, MINUTE_MS);
  return () => window.clearInterval(timer);
}

function readMinute(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

function noSubscription(): () => void {
  return () => {};
}

/**
 * The clock of the list (9.4, 9.5.8): the build's instant in the prerendered HTML and through
 * the hydration, so both paint the same rows and dates; the visitor's minute after it.
 */
function useClock(built: number): { now: number; hydrated: boolean } {
  const minute = useSyncExternalStore(subscribeMinute, readMinute, () => built);
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  return { now: hydrated ? minute : built, hydrated };
}

// -------------------------------------------------------------- the currency of the URL

function subscribeUrl(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(URL_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(URL_EVENT, onChange);
  };
}

function readSearch(): string {
  return window.location.search;
}

function serverSearch(): string {
  return '';
}

/** The currency the URL names (9.5.4): the price range reads it, and U4 keeps only a valid one. */
function currencyOf(search: string): PriceCurrency | null {
  const value = new URLSearchParams(search).get('moneda');
  return TRADE_CURRENCIES.find((currency) => currency === value) ?? null;
}

/**
 * The controller of 7.5.4 closes every panel, pinned ones included, on `ac:modal-open` (TT12),
 * the one «close all» it offers. A type change closes the open panel (9.5.3, CA-9.3).
 */
function closePanels(): void {
  document.dispatchEvent(new CustomEvent('ac:modal-open'));
}

// --------------------------------------------------------------------- the deferred part
//
// Cards is the view the page prerenders and hydrates, so its pieces are part of the island.
// Slots and Lista are only drawn when the state asks for them, so their components load as
// deferred chunks of 13.6 (`import()`) — the same modules the Pokédex and Ítems load that way,
// not a copy. They are asked for as soon as the island is idle after hydrating, so a switch
// finds them ready, and at once when the URL or the saved view needs them (PR4): until they
// are here the root is not `ready`, so it keeps `data-ac-pending`. A chunk that does not load
// is the data error of PR5.

interface Deferred {
  SlotsPanel: typeof SlotsModule.SlotsPanel;
  SlotsPanelItem: typeof SlotsModule.SlotsPanelItem;
  EntitySlot: typeof SlotModule.EntitySlot;
  DataTable: typeof TableModule.DataTable;
  ListRow: typeof RowModule.ListRow;
}

let deferred: Deferred | undefined;
let request: Promise<void> | undefined;

function loadDeferred(): Promise<void> {
  request ??= Promise.all([
    import('@/components/cards/SlotsPanel'),
    import('@/components/game/EntitySlot'),
    import('@/components/content/DataTable'),
    import('@/components/cards/ListRow'),
  ]).then(
    ([slots, slot, table, row]) => {
      deferred = {
        SlotsPanel: slots.SlotsPanel,
        SlotsPanelItem: slots.SlotsPanelItem,
        EntitySlot: slot.EntitySlot,
        DataTable: table.DataTable,
        ListRow: row.ListRow,
      };
    },
    (error: unknown) => {
      // A chunk that failed is asked for again the next time the state needs it.
      request = undefined;
      throw error;
    },
  );
  return request;
}

// -------------------------------------------------------------------------------- root

export interface TradeListRootProps {
  /** `market`: `/{l}/comercio/` (9.5). `seller`: the «Anuncios» of a profile (9.8). */
  variant: 'market' | 'seller';
  /** Picks the format of the figures, the dates and the k/kk (C-R3). */
  locale: Locale;
  /** The page without a query: the base of every page link (H6, PR2). */
  path: string;
  /**
   * The first page of the default state (market) or every row (seller): a `TradeData` (PR5,
   * `tradeData`) as one JSON text. Astro writes each value of an island's props with a type tag
   * of its own (`[0, value]`), which a list of short values pays for twice; one text is one value
   * (13.6: at most 20 KB of props).
   */
  data: string;
  /** Rows of the whole list. */
  total: number;
  /** `/{l}/comercio/datos.json` when the list is longer than its first page (PR5). */
  dataUrl?: string;
  /** The instant of the build, ISO 8601: the clock of the prerendered HTML (9.4). */
  builtAt: string;
  sprites: TradeSprites;
  /** The worlds of content/mundos.json, in their order (9.5.4): `[id, nombre]`. */
  worlds?: readonly (readonly [string, string])[];
  /** The `moneda` lists of the Diamonds in the page's language (§3.13). */
  diamonds: TradeCurrencyLists | null;
  /** The name of the Slots panel and the caption of the Lista. */
  caption: string;
  /** Name of the pagination, when the page has another one (the profile's reviews). */
  paginationLabel?: string;
  /** `tradeUi(messages.ui)` of the page's locale. */
  ui: TradeUi;
  labels: TradeListLabels;
}

export function TradeListRoot({
  variant,
  locale,
  path,
  data,
  total,
  dataUrl,
  builtAt,
  sprites,
  worlds = [],
  diamonds,
  caption,
  paginationLabel,
  ui,
  labels,
}: TradeListRootProps) {
  const market = variant === 'market';
  const { now, hydrated } = useClock(Date.parse(builtAt));

  // PR5: the whole list and its refs, taken when `dataUrl` answers.
  const [loaded, setLoaded] = useState<TradeRecords | null>(null);
  const decode = useCallback(
    (json: unknown) => {
      const records = decodeTradeData(json, locale);
      setLoaded(records);
      return records.rows;
    },
    [locale],
  );
  const first = useMemo(() => decodeTradeData(JSON.parse(data), locale), [data, locale]);
  const refs = loaded?.refs ?? first.refs;

  const search = useSyncExternalStore(subscribeUrl, readSearch, serverSearch);
  const currency = market ? currencyOf(search) : null;
  const worldIds = useMemo(() => worlds.map(([id]) => id), [worlds]);
  const config = useMemo(
    () =>
      tradeConfig({
        variant,
        locale,
        worlds: worldIds,
        currency,
        refs,
        sorts: labels.sorts,
        dataUrl: total > first.rows.length ? dataUrl : undefined,
      }),
    [variant, locale, worldIds, currency, refs, labels.sorts, total, first.rows.length, dataUrl],
  );

  // 9.4: the listings that expired while the page was open leave the list.
  const items = useMemo(() => first.rows.filter((row) => isListed(row, now)), [first, now]);
  const controller = useListState(config, {
    items,
    total: total - (first.rows.length - items.length),
    decode,
    path,
  });
  const state = controller.state;

  // Once the whole list is here the page is cut from its live rows; before, the controller's
  // first page stands (PR5).
  const page: ListPage<TradeRow> = useMemo(
    () =>
      loaded === null
        ? controller.page
        : applyListState(
            config,
            loaded.rows.filter((row) => isListed(row, now)),
            controller.page.state,
          ),
    [loaded, controller.page, config, now],
  );
  const view = page.state.view;

  const context: TradeContext = useMemo(
    () => ({ locale, refs, sprites, diamonds, ui, labels }),
    [locale, refs, sprites, diamonds, ui, labels],
  );

  // The Diamonds panel of every price (7.5.3): the Diamond turns in Comercio (7.8). Without a
  // row it is no panel, and the Diamonds of a price stay text (R2).
  const diamondsPanel = useMemo(
    () =>
      diamonds === null
        ? null
        : diamondsTip(
            {
              seCompranEn: localized(locale, diamonds.seCompranEn),
              seUsanEn: localized(locale, diamonds.seUsanEn),
            },
            locale,
            ui.tooltip,
            { sprite: sprites.types.diamonds, animated: true },
          ),
    [diamonds, locale, ui.tooltip, sprites.types.diamonds],
  );

  // The deferred part (see above): whether the state needs it, and whether it is here.
  const later = deferred;
  const absent = later === undefined && view !== 'cards';
  const [, setArrived] = useState(0);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (!absent) return undefined;
    let live = true;
    loadDeferred().then(
      () => {
        if (!live) return;
        setBroken(false);
        setArrived((count) => count + 1);
      },
      () => {
        if (live) setBroken(true);
      },
    );
    return () => {
      live = false;
    };
  }, [absent]);
  useEffect(() => {
    const prefetch = () => {
      loadDeferred().catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(prefetch);
      return () => window.cancelIdleCallback(handle);
    }
    const handle = window.setTimeout(prefetch);
    return () => window.clearTimeout(handle);
  }, []);

  let list: ListController<TradeRow> = { ...controller, page };
  if (absent) list = broken ? { ...list, failed: true } : { ...list, ready: false };

  // ------------------------------------------------------------------- the price range
  // The two ends as typed: the URL keeps them trimmed, and a field that is being typed in
  // shows what was typed until it loses the focus.
  const [typed, setTyped] = useState<RangeFieldValue | null>(null);
  const range: RangeFieldValue = typed ?? {
    min: state.filters.min ?? '',
    max: state.filters.max ?? '',
  };
  const invalid = (text: string) =>
    currency !== null && text.trim() !== '' && parsePrice(text, currency, locale) === null;
  const invalidMin = invalid(range.min);
  const invalidMax = invalid(range.max);
  // 9.5.4: an end that does not read carries `aria-invalid` and the hidden «Importe no
  // válido». `RangeField` has no prop for either, so they are set on its two fields by id.
  useEffect(() => {
    if (!market) return;
    const ends: [string, boolean][] = [
      ['min', invalidMin],
      ['max', invalidMax],
    ];
    for (const [end, wrong] of ends) {
      const input = document.getElementById(`${PRICE_ID}-${end}`);
      if (input === null) continue;
      if (wrong) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', `${PRICE_ID}-error`);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }
  });

  const setRange = (next: RangeFieldValue) => {
    setTyped(next);
    if (next.min !== range.min) controller.setFilter('min', next.min.trim() || null);
    if (next.max !== range.max) controller.setFilter('max', next.max.trim() || null);
  };
  const leaveRange = (event: FocusEvent<HTMLFieldSetElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setTyped(null);
  };

  // ------------------------------------------------------------------------ controls
  const filters = state.filters;
  const typeOptions: ToggleGroupOption[] = [
    { value: '', label: labels.allTypes },
    ...TIPOS_ACTIVO.map((type): ToggleGroupOption => {
      const sprite = sprites.types[type];
      return sprite === null
        ? { value: type, label: labels.types[type] }
        : { value: type, label: labels.types[type], sprite };
    }),
  ];
  const worldOptions: SelectOption[] = [
    { value: '', label: labels.allWorlds },
    ...worlds.map(([id, name]) => ({ value: id, label: name })),
  ];
  const currencyOptions: SelectOption[] = [
    { value: '', label: labels.allCurrencies },
    ...TRADE_CURRENCIES.map((id) => ({ value: id, label: currencyName(id, ui) })),
  ];
  const ratingOptions: SelectOption[] = [
    { value: '', label: labels.allRatings },
    ...RATING_FLOORS.map((floor) => ({ value: floor, label: labels.ratings[floor] })),
  ];

  const controls = market ? (
    <>
      <div className="ac-trade-list__search">
        <TextField
          variant="search"
          label={labels.search}
          placeholder={labels.searchPlaceholder}
          value={controller.query}
          onChange={(value) => controller.setQuery(value)}
          inputProps={{ autoComplete: 'off', spellCheck: false, enterKeyHint: 'search' }}
        />
        <Button href={publishHref(locale)}>{labels.publish}</Button>
      </div>
      <ToggleGroup
        variant="tab"
        label={labels.type}
        labelHidden={false}
        options={typeOptions}
        value={filters.tipo ?? ''}
        onChange={(value) => {
          closePanels();
          controller.setFilter('tipo', value || null);
        }}
      />
      <FilterBar>
        {worlds.length > 1 ? (
          <Select
            label={labels.world}
            options={worldOptions}
            value={filters.mundo ?? ''}
            onChange={(value) => controller.setFilter('mundo', value || null)}
          />
        ) : null}
        <Select
          label={labels.currency}
          options={currencyOptions}
          value={filters.moneda ?? ''}
          onChange={(value) => controller.setFilter('moneda', value || null)}
        />
        <RangeField
          id={PRICE_ID}
          legend={currency === null ? labels.priceDisabled : labels.price}
          placeholders={[ui.rangeMin, ui.rangeMax]}
          labels={[labels.minLabel, labels.maxLabel]}
          inputMode={
            currency === 'pokedolares' ? 'text' : currency === 'diamonds' ? 'numeric' : 'decimal'
          }
          value={range}
          onChange={setRange}
          onBlur={leaveRange}
          disabled={currency === null}
        />
        <Select
          label={labels.rating}
          options={ratingOptions}
          value={filters.val ?? ''}
          onChange={(value) => controller.setFilter('val', value || null)}
        />
      </FilterBar>
      <Checkbox
        label={labels.onlyInGame}
        checked={filters.presencia === IN_GAME}
        onChange={(checked) => controller.setFilter('presencia', checked ? IN_GAME : null)}
      />
      {invalidMin || invalidMax ? (
        <span id={`${PRICE_ID}-error`} className="sr-only">
          {labels.invalidAmount}
        </span>
      ) : null}
    </>
  ) : undefined;

  const sort = market ? (
    <SortSelect
      label={ui.sortBy}
      options={LISTING_ORDERS.map((id) => ({ value: id, label: labels.sorts[id] }))}
      value={state.sort}
      onChange={(value) => controller.setSort(value)}
    />
  ) : undefined;

  // --------------------------------------------------------------------------- views
  const anchor = (row: TradeRow) => config.anchorId?.(row);
  const posted = (row: TradeRow) =>
    hydrated
      ? formatRelative(row.publicado, locale, new Date(now))
      : formatDate(row.publicado, locale);
  const diamondsLink = diamondsPanel === null ? null : { tip: diamondsPanel };
  const cardLabels: ListingCardLabels = { ...labels.card, shiny: ui.shiny, money: ui.money };
  // The groups of 9.5.8: in «Todos» and always in the profile; one type has none.
  const grouped = !market || filters.tipo === undefined;
  const groupLevel = market ? 2 : 3;

  let position = 0;
  const lazy = () => {
    const index = position;
    position += 1;
    return index >= EAGER_ART ? ('lazy' as const) : undefined;
  };

  const grid = (rows: readonly TradeRow[], headingLevel?: 2) => {
    const cards = rows.map((row) => listingCard(row, context, posted(row)));
    const layout = listingLayout(cards);
    return (
      <CardGrid family="listing" headingLevel={headingLevel}>
        {rows.map((row, index) => (
          <ListingCard
            key={row.id}
            id={anchor(row)}
            listing={cards[index] ?? listingCard(row, context, posted(row))}
            layout={layout}
            labels={cardLabels}
            locale={locale}
            hint={ui.pinHint}
            orLabel={ui.or}
            diamonds={diamondsLink}
            loading={lazy()}
          />
        ))}
      </CardGrid>
    );
  };

  const slotsView = (current: ListPage<TradeRow>, parts: Deferred): ReactNode => {
    const { SlotsPanel, SlotsPanelItem, EntitySlot } = parts;
    const slot = (row: TradeRow) => {
      const sprite = listingSprite(row, context);
      return (
        <SlotsPanelItem key={row.id} id={anchor(row)}>
          <EntitySlot
            size={72}
            name={row.accesible}
            price={priceLabel(row, context)}
            sprite={sprite === null ? null : { ...sprite, loading: lazy() }}
            qty={stackOf(row)}
            shiny={isShiny(row, context)}
            tip={listingTip(row, context)}
            href={listingHref(locale, row.id)}
            locale={locale}
            hint={ui.pinHint}
            shinyLabel={ui.shiny}
            orLabel={ui.or}
          />
        </SlotsPanelItem>
      );
    };
    // 9.5.8: the Slots keep their groups by type with one type too (`Lienzo:Comercio`, type tabs
    // in Slots): the label column names the type the tab chose.
    return (
      <SlotsPanel
        label={caption}
        layout="side"
        groups={current.groups.map((group) => ({
          key: group.key,
          label: labels.types[group.key as TipoActivo] ?? group.key,
          children: group.items.map(slot),
        }))}
      />
    );
  };

  const listView = (current: ListPage<TradeRow>, parts: Deferred): ReactNode => {
    const { DataTable, ListRow } = parts;
    const { columns, card } = labels;
    const tableColumns: DataTableColumn[] = [
      { key: 'sprite', label: columns.sprite, srOnly: true, width: LIST_WIDTHS.sprite },
      { key: 'listing', label: columns.listing },
      { key: 'type', label: columns.type, width: LIST_WIDTHS.type },
      { key: 'world', label: labels.world, width: LIST_WIDTHS.world },
      { key: 'fiat', label: card.fiat, width: LIST_WIDTHS.fiat },
      { key: 'game', label: card.game, width: LIST_WIDTHS.game },
      { key: 'seller', label: card.seller, width: LIST_WIDTHS.seller },
      { key: 'posted', label: columns.posted, width: LIST_WIDTHS.posted },
    ];
    return (
      <DataTable caption={caption} columns={tableColumns} dense hover scroll>
        {current.items.map((row) => {
          const sprite = listingSprite(row, context);
          const pokemon = row.tipo === 'pokemon';
          const seller = Object.hasOwn(refs.vendedores, row.vendedor)
            ? refs.vendedores[row.vendedor]
            : null;
          const fiat = fiatText(row.precio, locale);
          const options = gameOptions(row.precio);
          const presence = sellerPresence(seller, context);
          const sub = listSub(row, context);
          // 9.15.2: in phase B the tag «Dinero real» follows what the row declares.
          const tag =
            card.realMoney !== undefined && fiat !== null ? <Chip>{card.realMoney}</Chip> : null;
          const loading = lazy();
          let art: ReactNode;
          if (sprite === null) art = <MissingSprite size={pokemon ? 40 : 16} />;
          else if (pokemon) {
            art = (
              <Sprite {...sprite} smooth width={LIST_ART} height={LIST_ART} loading={loading} />
            );
          } else {
            art = <SpriteStage sprite={{ ...sprite, loading }} size={32} framed={false} />;
          }
          return (
            <ListRow
              key={row.id}
              id={anchor(row)}
              variant="listing"
              frame={pokemon ? 'box' : 'framed'}
              qty={stackOf(row)}
              sprite={art}
              name={listingTitleNode(row)}
              href={listingHref(locale, row.id)}
              sub={
                tag === null ? (
                  sub
                ) : (
                  <span className="ac-trade-list__sub">
                    {sub}
                    {tag}
                  </span>
                )
              }
              tip={listingTip(row, context)}
              hint={ui.pinHint}
              shinyLabel={ui.shiny}
              orLabel={ui.or}
              locale={locale}
              cells={[
                labels.typeCells[row.tipo],
                {
                  content: Object.hasOwn(refs.mundos, row.mundo) ? refs.mundos[row.mundo] : null,
                  nowrap: true,
                },
                // 9.5.8: 100 wide at 944 (CA-9.7). An amount with cents does not fit it in 700,
                // so here the symbol and the figure may part at the end of the line
                // (trade-list.css): a normal space where formatRealMoney writes a hard one.
                fiat !== null ? (
                  <span className="ac-trade-list__fiat">{fiat.replace(HARD_SPACE, ' ')}</span>
                ) : row.precio.aConvenir ? (
                  labels.card.negotiable
                ) : null,
                options.length > 0 ? (
                  <PriceOptions
                    options={options}
                    locale={locale}
                    orLabel={ui.or}
                    align="center"
                    link={diamondsLink === null ? undefined : { ...diamondsLink, hint: ui.pinHint }}
                  />
                ) : null,
                seller === null ? null : (
                  <span className="ac-trade-list__seller">
                    <Rating
                      seller={seller.nombre}
                      href={sellerHref(locale, row.vendedor)}
                      score={seller.valoracion}
                      reviews={seller.resenas}
                      locale={locale}
                      labels={ui.money}
                    />
                    {presence === null ? null : (
                      <SellerPresence state={presence.state} label={presence.label} />
                    )}
                  </span>
                ),
                // 100 wide at 944 (9.5.8, CA-9.7). The relative times fit on one line; from
                // 24 h the date does in `es` («18/09/2026») and not in `en` («Sep 18, 2026»,
                // §13.3), which breaks at its spaces instead of widening the table.
                {
                  content: <time dateTime={row.publicado}>{posted(row)}</time>,
                  small: true,
                },
              ]}
            />
          );
        })}
      </DataTable>
    );
  };

  const views: Record<EntityView, (current: ListPage<TradeRow>) => ReactNode> = {
    cards: (current) =>
      grouped
        ? current.groups.map((group) => {
            const type = group.key as TipoActivo;
            return (
              <CardGroup
                key={group.key}
                label={labels.types[type] ?? group.key}
                count={group.items.length}
                sprite={sprites.types[type] ?? null}
                level={groupLevel}
                locale={locale}
              >
                {grid(group.items)}
              </CardGroup>
            );
          })
        : grid(current.items, 2),
    slots: (current) => (later === undefined ? null : slotsView(current, later)),
    list: (current) => (later === undefined ? null : listView(current, later)),
  };

  // 9.5.10: the line that fits what narrowed the list, and one action that empties `q` and
  // every filter while it keeps the order and the view.
  const empty = (shown: ListState) => {
    if (!market) return <EmptyState>{labels.emptySeller}</EmptyState>;
    const narrowed = Object.keys(shown.filters).length > 0;
    if (!narrowed && shown.q === '') return <EmptyState>{labels.none}</EmptyState>;
    const line = narrowed ? labels.emptyFilters : fill(labels.emptyQuery, { q: shown.q });
    return (
      <EmptyState
        action={<Button onClick={() => controller.clearFilters()}>{labels.clearFilters}</Button>}
      >
        {line}
      </EmptyState>
    );
  };

  // `ui` carries every text of `EntityListLabels` under the same keys (13.2).
  const listLabels: EntityListLabels = ui;

  return (
    <EntityList
      controller={list}
      labels={listLabels}
      count={(n) => counted(labels.count, n, locale)}
      empty={empty}
      views={views}
      controls={controls}
      sort={sort}
      paginationLabel={paginationLabel}
      className="ac-trade-list"
    />
  );
}
