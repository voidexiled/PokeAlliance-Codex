// Layout of a card grid (spec 7.6.2, 7.6.3; CARD_GRID_SYSTEM §5.3; DS:guias/30 «Claves de una
// rejilla»). Every card of a grid is built from one layout, so every card spans the same row
// tracks and its zones line up across the row. A layout is the union over the cards the grid
// shows: the canonical keys of the family, in canonical order, that at least one card has a
// value for; the optional zones and the price rows at least one card has. A key no card has
// disappears; a key some card has stays and the cards that miss it show «—».
//
// Plain data and no React: the same call runs in the frontmatter of a static grid and inside an
// island (`useMemo` over the page after filtering, sorting and paginating), so the prerendered
// HTML and the hydrated island compute the same tracks (7.6.3, PR1).
//
// Ported from the reference `components/bundle.js` (`gridKeys`, `listingLayout`, `listingKeys`,
// `lootKeys`, `lootValues`), with the additions of 7.6.2 and 7.6.3: `dexLayout` and
// `trackCount`. The keys are ids, never labels. The reference keys its facts by their Spanish
// label ('Requisito', 'Memory Slots'); here each key is the camelCase id the dictionary uses
// (§13.2), and every card family receives the visible label of each key by props (DP1), so a
// missing label can never fall back to Spanish text in the `en` pages:
//
//   Reference        Id               Reference        Id
//   Requisito        requirement      Cantidad         quantity
//   Tier             tier             Categoría        category
//   Elementos        elements         Elemento         element
//   Ball             ball             Uso              use
//   Aura             aura             Drop de          droppedBy
//   Boost            boost            Se compran en    boughtAt
//   Nickname         nickname         Se usan en       usedFor
//   Memory Slots     memorySlots      Precio NPC       npcPrice
//   Star Level       starLevel        Rol              role
//   NPC Price        npcPrice         Variante         variant
//
// Two keys have no reference counterpart: `shopPrice` («Precio de tienda», the second price of
// the item cards of 8.5, Q12) and the Pokédex facts, which the reference always draws and 8.2
// turns into a union (`dexLayout`).
import { gridKeys as unionKeys, present } from '@/lib/format/unknown';

/** Card family of a grid: its minimum card width, column range and phone gap (7.6.1). */
export type CardFamily = 'listing' | 'pokedex' | 'loot' | 'featured' | 'index' | 'kpi' | 'info';

/** The families whose cards sit on subgrid tracks, and so have a track count (7.6.2). */
export type AnatomyFamily = 'listing' | 'pokedex' | 'loot' | 'kpi';

// ------------------------------------------------------------------------------ union rule

/** The values of one entity by key; a key it does not carry reads as unknown. */
type KeyValues<Key extends string> = Readonly<Partial<Record<Key, unknown>>>;

/**
 * Keys of one grid: the canonical keys, in canonical order, that at least one item of the result
 * set has a value for (G7, CARD_GRID_SYSTEM §5.3). The rule itself is `gridKeys` of
 * `src/lib/format/unknown.ts`; this is the reference signature, whose optional `values` reads
 * the values of an item by key, so a card model keeps its own shape.
 */
export function gridKeys<Key extends string>(
  canon: readonly Key[],
  items: readonly KeyValues<Key>[],
): Key[];
export function gridKeys<Key extends string, Item>(
  canon: readonly Key[],
  items: readonly Item[],
  values: (item: Item) => KeyValues<Key> | null | undefined,
): Key[];
export function gridKeys<Key extends string, Item>(
  canon: readonly Key[],
  items: readonly Item[],
  values?: (item: Item) => KeyValues<Key> | null | undefined,
): Key[] {
  const read = values ?? ((item: Item) => item as KeyValues<Key>);
  // An item with no values at all knows none of the keys.
  const nothing = {} as KeyValues<Key>;
  return unionKeys(
    canon,
    items.map((item) => read(item) ?? nothing),
  );
}

// -------------------------------------------------------------------- Comercio listing

/** Asset type of a listing (§9.4). A grid never mixes two (7.6.3). */
export type ListingType = 'pokemon' | 'items' | 'diamonds' | 'pokedolares';

/** Fact keys of a Pokémon listing (DS:ListingCard, §9.5.8). */
export type PokemonListingKey =
  | 'requirement'
  | 'tier'
  | 'elements'
  | 'ball'
  | 'aura'
  | 'boost'
  | 'nickname'
  | 'memorySlots'
  | 'starLevel'
  | 'npcPrice';
/** Fact keys of an items listing. */
export type ItemsListingKey = 'quantity' | 'category' | 'element' | 'use' | 'droppedBy';
/** Fact keys of a Diamonds listing. */
export type DiamondsListingKey = 'quantity' | 'boughtAt' | 'usedFor';
/** Fact keys of a Pokédólares listing. */
export type PokedolaresListingKey = 'quantity';
export type ListingKey =
  PokemonListingKey | ItemsListingKey | DiamondsListingKey | PokedolaresListingKey;

/** Canonical fact keys per asset type, in display order (DS:ListingCard, `AC.listingKeys`). */
export const listingKeys = {
  pokemon: [
    'requirement',
    'tier',
    'elements',
    'ball',
    'aura',
    'boost',
    'nickname',
    'memorySlots',
    'starLevel',
    'npcPrice',
  ],
  items: ['quantity', 'category', 'element', 'use', 'droppedBy'],
  diamonds: ['quantity', 'boughtAt', 'usedFor'],
  pokedolares: ['quantity'],
} as const satisfies Record<ListingType, readonly ListingKey[]>;

/**
 * Optional zones of a listing card, in anatomy order (16.4.5, owner rule 2026-09-25): the line of
 * the Ball, the held items and the Mega Stone (`gear`), the Auras, the Addons and Entrenamiento.
 * Each kind of equipment has its own place: a grid where one listing has Auras gives every card
 * the Auras track, and a card without them leaves it empty, so the next zone starts at the same
 * height in the whole row.
 */
export type ListingZone = 'gear' | 'auras' | 'addons' | 'train';
/**
 * The groups of the `gear` line, in order: Ball, Held Items (X, Y) and Mega Stone. A group one
 * listing of the grid has keeps its column in every card, empty where a card lacks it.
 */
export type ListingGear = 'ball' | 'held' | 'mega';
/** Price rows of the footer, in anatomy order: Dinero real, En el juego. */
export type ListingPriceRow = 'fiat' | 'game';

/** Zones and rows of one grid of listings: the union over the listings it shows. */
export interface ListingLayout {
  type: ListingType;
  /** Canonical fact keys of `type` that at least one listing of the grid has. */
  keys: ListingKey[];
  /** Optional zones present in the grid. */
  zones: ListingZone[];
  /** Groups of the `gear` zone present in the grid; empty when the zone is absent. */
  gear: ListingGear[];
  /** Price rows present in the grid. */
  price: ListingPriceRow[];
}

/**
 * What `listingLayout` reads of a listing: the fields of the reference `Listing` that decide
 * the anatomy. A card model with more fields (title, sprite, seller…) is accepted as it is.
 */
export interface ListingLayoutInput {
  type: ListingType;
  /** Facts by key; unknown values are `null` or absent. */
  facts?: Readonly<Partial<Record<ListingKey, unknown>>> | null;
  /** Equipment of a Pokémon by kind; each zone or group exists when one listing has it. */
  equipment?: ListingEquipmentInput | null;
  /** Training shown on the card, or `null`. */
  train?: unknown;
  /** Real-money price, or `null`. */
  fiat?: unknown;
  /** In-game price options. */
  game?: readonly unknown[] | null;
  /** `precio.aConvenir`: «A convenir» takes the first price row of the grid (§9.5.8). */
  negotiable?: boolean;
}

/** What `listingLayout` reads of the equipment of a listing: which kinds it carries. */
export interface ListingEquipmentInput {
  ball?: unknown;
  auras?: readonly unknown[] | null;
  addons?: readonly unknown[] | null;
  heldX?: unknown;
  heldY?: unknown;
  mega?: unknown;
}

const LISTING_ZONES: readonly ListingZone[] = ['gear', 'auras', 'addons', 'train'];
const LISTING_GEAR: readonly ListingGear[] = ['ball', 'held', 'mega'];
const LISTING_PRICE_ROWS: readonly ListingPriceRow[] = ['fiat', 'game'];
/** «Vendedor» and «Contacto verificado» close every listing footer (7.6.2). */
const LISTING_FIXED_FOOTER_ROWS = 2;

function isListingType(value: unknown): value is ListingType {
  return typeof value === 'string' && Object.hasOwn(listingKeys, value);
}

function hasGear(listing: ListingLayoutInput, gear: ListingGear): boolean {
  const equipment = listing.equipment;
  if (!equipment) return false;
  if (gear === 'held') return present(equipment.heldX) || present(equipment.heldY);
  return present(equipment[gear]);
}

function hasZone(listing: ListingLayoutInput, zone: ListingZone): boolean {
  if (zone === 'train') return Boolean(listing.train);
  if (zone === 'gear') return LISTING_GEAR.some((gear) => hasGear(listing, gear));
  return present(listing.equipment?.[zone]);
}

function hasPrice(listing: ListingLayoutInput, row: ListingPriceRow): boolean {
  return row === 'fiat' ? present(listing.fiat) : present(listing.game);
}

/**
 * Layout of one grid of listings (7.6.3). Throws when the listings are of two types, because a
 * grid never mixes them: Comercio «Todos» paginates first, groups by type afterwards, and each
 * group computes its own layout from its own cards (§9.5.8). An empty set has nothing to lay
 * out and returns the reference's empty Pokémon layout.
 */
export function listingLayout(listings: readonly ListingLayoutInput[]): ListingLayout {
  const first = listings[0];
  const type: ListingType = first === undefined ? 'pokemon' : first.type;
  for (const listing of listings) {
    if (!isListingType(listing.type)) {
      throw new Error(`listingLayout: «${String(listing.type)}» is not a listing type (§9.4).`);
    }
    if (listing.type !== type) {
      throw new Error(
        `listingLayout: one grid never mixes listing types (7.6.3), got «${type}» and «${listing.type}».`,
      );
    }
  }
  return {
    type,
    keys: gridKeys<ListingKey, ListingLayoutInput>(
      listingKeys[type],
      listings,
      (listing) => listing.facts,
    ),
    zones: LISTING_ZONES.filter((zone) => listings.some((listing) => hasZone(listing, zone))),
    gear: LISTING_GEAR.filter((gear) => listings.some((listing) => hasGear(listing, gear))),
    price: priceRows(listings),
  };
}

/**
 * The price rows of the grid (7.6.3), in anatomy order. A listing «A convenir» with no price
 * writes that text in the first price row of its grid (§9.5.8), so a grid where no listing
 * has a price and one of them is «A convenir» still gets the first row, «Dinero real»:
 * without it the text would have nowhere to go.
 */
function priceRows(listings: readonly ListingLayoutInput[]): ListingPriceRow[] {
  const rows = LISTING_PRICE_ROWS.filter((row) =>
    listings.some((listing) => hasPrice(listing, row)),
  );
  if (rows.length === 0 && listings.some((listing) => listing.negotiable === true)) {
    return [LISTING_PRICE_ROWS[0]];
  }
  return rows;
}

// ---------------------------------------------------------------------- Pokédex entry

/** Fact keys of a Pokédex card: Requisito, Tier, Rol, Variante (DS:DexCard, §8.2). */
export type DexKey = 'requirement' | 'tier' | 'role' | 'variant' | 'moveset';
/** The Pokédex facts in display order. */
export const DEX_KEYS: readonly DexKey[] = ['requirement', 'tier', 'role', 'variant', 'moveset'];

/** Zones of a Pokédex card after its facts, in anatomy order: element chips, drops. */
export type DexZone = 'elements' | 'drops';

/** Facts and zones of one grid of Pokédex cards: the union over the entries it shows. */
export interface DexLayout {
  /** Pokédex facts that at least one entry of the grid has. */
  keys: DexKey[];
  /** Zones present in the grid. */
  zones: DexZone[];
}

/**
 * What `dexLayout` reads of an entry: the fields of the reference `DexEntry` that decide the
 * anatomy. `level` is the value of the Requisito fact («Nivel 80»).
 */
export interface DexLayoutInput {
  level?: unknown;
  tier?: unknown;
  role?: unknown;
  variant?: unknown;
  /** `elementoMoveset` (§16.4.2): the «Moveset» fact, only when an entry has it. */
  moveset?: unknown;
  /** Element chips; the zone exists when one entry of the grid has at least one. */
  elements?: readonly unknown[] | null;
  /** Drops of the registry; the zone exists when one entry of the grid has at least one (8.2). */
  drops?: readonly unknown[] | null;
}

const DEX_ZONES: readonly DexZone[] = ['elements', 'drops'];

/** Values of an entry by Pokédex fact key. */
export function dexValues<Entry extends DexLayoutInput>(
  entry: Entry,
): {
  requirement: Entry['level'];
  tier: Entry['tier'];
  role: Entry['role'];
  variant: Entry['variant'];
  moveset: Entry['moveset'];
} {
  return {
    requirement: entry.level,
    tier: entry.tier,
    role: entry.role,
    variant: entry.variant,
    moveset: entry.moveset,
  };
}

/**
 * Layout of one grid of Pokédex cards (7.6.3): the facts of the union and the zones present.
 * With twelve Pokémon without tier or role on the page, the grid has neither track (7.6.2).
 */
export function dexLayout(entries: readonly DexLayoutInput[]): DexLayout {
  return {
    keys: gridKeys<DexKey, DexLayoutInput>(DEX_KEYS, entries, dexValues),
    zones: DEX_ZONES.filter((zone) => entries.some((entry) => present(entry[zone]))),
  };
}

// ----------------------------------------------------------------------------- loot / drop

/**
 * Fact keys of a loot or drop card, in display order: Drop de, Elemento, Uso, Cantidad, Precio
 * NPC (DS:LootCard, §8.3) and Precio de tienda, which only the item pages give (§8.5, Q12).
 */
export type LootKey = 'droppedBy' | 'element' | 'use' | 'quantity' | 'npcPrice' | 'shopPrice';
/** The loot facts in display order. */
export const LOOT_KEYS: readonly LootKey[] = [
  'droppedBy',
  'element',
  'use',
  'quantity',
  'npcPrice',
  'shopPrice',
];

/**
 * The fields of a loot or drop entry that its facts come from (the reference `LootDrop`).
 * `qty` arrives written: «2», or «1 a 3» / «1 to 3» (§8.3), which is copy the page composes from
 * `drops[].cantidad`; the reference joined `[min, max]` with an en dash. `npcPrice` and
 * `shopPrice` are Pokédólares in whole units (S8).
 */
export interface LootFields {
  dropDe?: unknown;
  element?: unknown;
  use?: unknown;
  qty?: unknown;
  npcPrice?: unknown;
  shopPrice?: unknown;
}

/** Values of a drop by loot key. */
export type LootValues<Drop extends LootFields> = {
  droppedBy: Drop['dropDe'];
  element: Drop['element'];
  use: Drop['use'];
  quantity: Drop['qty'];
  npcPrice: Drop['npcPrice'];
  shopPrice: Drop['shopPrice'];
};

/** Values of a drop by canonical key (`AC.lootValues`). */
export function lootValues<Drop extends LootFields>(drop: Drop): LootValues<Drop> {
  return {
    droppedBy: drop.dropDe,
    element: drop.element,
    use: drop.use,
    quantity: drop.qty,
    npcPrice: drop.npcPrice,
    shopPrice: drop.shopPrice,
  };
}

/** Keys of one loot grid: the canonical keys at least one drop of the result set has (`AC.lootKeys`). */
export function lootKeys(drops: readonly LootFields[]): LootKey[] {
  return gridKeys<LootKey, LootFields>(LOOT_KEYS, drops, lootValues);
}

// ----------------------------------------------------------------------------- tracks

/** Guild KPI: label, figure and comparison (DS:KpiCard). */
const KPI_TRACKS = 3;

/**
 * Z, the row tracks a card spans (`grid-row: span Z`, 7.6.2). It depends on the layout only,
 * never on the card, so every card of a grid spans the same tracks:
 *
 * - `listing`: head + keys + the equipment zones (gear line, Auras, Addons) + Entrenamiento +
 *   the footer rows (Dinero real, En el juego, Vendedor, Contacto verificado);
 * - `pokedex`: head + keys + element chips + drops;
 * - `loot`: head + keys (the `lootKeys` of the grid);
 * - `kpi`: 3.
 */
export function trackCount(family: 'listing', layout: ListingLayout): number;
export function trackCount(family: 'pokedex', layout: DexLayout): number;
export function trackCount(family: 'loot', keys: readonly LootKey[]): number;
export function trackCount(family: 'kpi'): number;
export function trackCount(
  family: AnatomyFamily,
  layout?: ListingLayout | DexLayout | readonly LootKey[],
): number {
  switch (family) {
    case 'listing': {
      const { keys, zones, price } = layout as ListingLayout;
      return 1 + keys.length + zones.length + price.length + LISTING_FIXED_FOOTER_ROWS;
    }
    case 'pokedex': {
      const { keys, zones } = layout as DexLayout;
      return 1 + keys.length + zones.length;
    }
    case 'loot':
      return 1 + (layout as readonly LootKey[]).length;
    case 'kpi':
      return KPI_TRACKS;
  }
}
