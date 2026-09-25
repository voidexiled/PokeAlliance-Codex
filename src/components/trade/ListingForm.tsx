import '@/styles/components/listing-form.css';

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { flushSync } from 'react-dom';

import { Button } from '@/components/controls/Button';
import { Checkbox } from '@/components/controls/Checkbox';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { Select, type SelectOption } from '@/components/controls/Select';
import { StarLevel } from '@/components/controls/StarLevel';
import { Stepper } from '@/components/controls/Stepper';
import { TextField } from '@/components/controls/TextField';
import { TextLink } from '@/components/controls/TextLink';
import { ToggleGroup, type ToggleGroupOption } from '@/components/controls/ToggleGroup';
import { Sprite } from '@/components/game/Sprite';
import { TrainingMeter } from '@/components/money/TrainingMeter';
import {
  AddonPicker,
  AuraPicker,
  HeldPicker,
  ItemPicker,
  MegaPicker,
  PokemonPicker,
  type PokemonFilterLabels,
} from '@/components/pickers/pickers';
import {
  itemPanel,
  decodeItems,
  decodeItemsRefs,
  type ItemsData,
  type ItemsRow,
} from '@/components/items/config';
import {
  decodePokedex,
  decodeRefs,
  type PokedexElementRefs,
  type PokedexRow,
} from '@/components/pokedex/config';
import type { Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { fill } from '@/i18n/messages/types';
import { usePanels } from '@/lib/game/panels';
import { pokemonPanel } from '@/lib/game/pokemon-panel';
import { gearTip, itemTip, pokemonTip } from '@/lib/game/tips';
import type { PickerLabels } from '@/lib/pickers/labels';
import { itemOptions, pokemonOptions } from '@/lib/pickers/options';
import { readStoredSession } from '@/lib/account/session-cache';
import { formatDate } from '@/lib/format/dates';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AccountCharacter } from '@/lib/supabase/trade';
import {
  BALL_CATEGORY,
  itemPickerRecords,
  rosterPickerRecords,
  slotRecords,
  type SlotEntity,
} from '@/lib/trade/pickers';
import {
  formatDiamonds,
  formatInteger,
  formatPokedolares,
  formatPokedolaresLabel,
  formatRealMoney,
  parsePokedolares,
} from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import type { SpriteData } from '@/lib/sprites/resolve';
import {
  compactKks,
  isDittoSlug,
  isValidOptionalPercent,
  parsePositiveWhole,
  parsePrice,
} from '@/lib/trade/draft';
import { ANUNCIOS_ACTIVOS_MAX, listingExpiry } from '@/lib/trade/limits';
import { listingTitle, type ListingNames } from '@/lib/trade/title';
import { hasUnitPrice, priceFromUnit, type UnitPriceLabels } from '@/lib/trade/unit-price';
import {
  BOOST_MAX,
  HABILIDADES,
  MEMORY_SLOTS_MAX,
  MONEDAS_JUEGO,
  MONEDAS_REALES,
  NIVEL_ENTRENAMIENTO_MAX,
  NOMBRE_MAX,
  SIMBOLOS_MONEDA,
  STAR_LEVEL_MAX,
  TIPOS_ACTIVO,
  tradesAcrossWorlds,
  type Anuncio,
  type MonedaJuego,
  type MonedaReal,
  type OpcionJuego,
  type Precio,
  type PrecioReal,
  type TipoActivo,
  type UnidadPokemon,
} from '@/lib/trade/types';

import type {
  ListingPreviewData,
  ListingPreviewDiamonds,
  ListingPreviewDraft,
  ListingPreviewLabels,
  ListingPreviewSprites,
} from './ListingPreview';
import type {
  ContactMessage,
  ContactSellerLabels,
  RealMoneyConsentLabels,
} from './RealMoneyConsent';
import { refusalFor, retryable, type RefusalLabels } from './refusals';

// ListingForm (spec 9.7, template G of 8.0.2; §12.16, §12.20 points 59–69): the island of
// `/{l}/comercio/publicar/`, «Crear anuncio». Since 16.4.4 the form is guided: every game entity
// is chosen in a picker (src/components/pickers), the asset type is a set of tiles, Boost and
// the training levels are steppers, Star Level is stars and the world is chips. With
// `publish` (COMERCIO_PUBLICO) the action is «Publicar anuncio» through
// src/lib/supabase/trade.ts, with the real-money consent. The owner's rules of 2026-09-24:
//
//   - «Vendes como» (board Personajes, Variante 2): a select of the account's characters, the
//     main one first and preselected; the world is the character's and cannot be changed
//     (Pokédólares: «Lo ven compradores de cualquier mundo»). Required for every type. Without
//     characters the row links to «Añadir personaje» in the account; the draft is kept.
//   - A price per unit for Items, Diamonds and Pokédólares: «Por unidad», a unit the seller
//     chooses and the computed total (src/lib/trade/unit-price.ts, the database's rule).
//   - Publishing (board Anuncio-publicado): the button reads «Publicando…» and the form is
//     locked; a failure keeps the data, says why and, when it may pass, offers «Reintentar»; the
//     success opens a dialog with the card, «Copiar enlace», «Ver anuncio», «Crear otro
//     anuncio» and «Mis anuncios», and the form starts empty.
//   - «Editar» (`?editar={id}`): the seller's listing fills the form, its type locked, and
//     «Guardar cambios» saves it, quantity included; then the listing page opens.
//   - No off-site helper: the text «para Discord» is gone.
//
// Phase A (no `publish`) has no account and no action: the form and its preview only.
// The form of a listing — «Tipo de activo», the fields of the asset (9.7.2, 9.7.3), «Precio»
// (9.7.4) and «Mundo» — and its live preview, the real `ListingCard` (ListingPreview.tsx,
// 9.7.6). It hydrates with `client:load` (7.3).
//
// What the spec fixes, and where it lives here:
//
//   - Each asset type keeps its own fields when the reader switches type and comes back
//     (9.7.1): the draft holds the four of them.
//   - The draft is kept per visitor in `localStorage['alliance-codex:comercio:borrador:v1']` on
//     every change and restored on arrival, every read and write inside `try/catch`; without
//     storage the form works the same and restores nothing (9.7.7). The page says nothing about
//     it (§12.16).
//   - Validation (9.7.5, A16): a field validates after its first interaction — a text field
//     once the reader changed it and leaves it, a number or a choice as soon as it changes —
//     and every field on the first press of the action. An error is text under its field joined
//     with `aria-describedby`, and the field carries `aria-invalid="true"`. On a press with
//     errors the focus goes to the first invalid field in the order of the page, and the folded
//     «Entrenamiento» opens first when that field is inside it. Nothing is announced while the
//     reader types: the preview is no live region (§12.20, 65) and an error is read with its
//     field.
//   - Single-choice groups are `ToggleGroup`, buttons with `aria-pressed` (T10, §12.20, 69):
//     the asset type (`tab`), the aura (`sprite`) and «NPC Price».
//   - No static Ball slot beside its field (§12.20, 60): a Ball, like every item, shows its
//     sprite in the list of its combobox and in the preview, and only when its name matches a
//     record (9.4, R2).
//   - Every in-game amount is Pokédólares or Diamonds (9.7.3, 9.7.4): «50kk», «2,5k» or the
//     figure grouped in the language of the page, read by `parsePokedolares`, which never
//     rounds. The exact figure of the Pokédólares of a listing shows live under its field, with
//     its sprite first (S8).
//   - HELD_TIER_MAX (Q8) and the real currencies (Q9) are the constants of
//     src/lib/trade/types.ts, like every other limit of the fields.
//
// Data. The props carry the small registries of the page, already in its language, and the
// sprites the adapter resolved (DP2). The whole Pokémon roster and the items are too big for
// props (13.6): once hydrated the island reads `/{l}/pokedex/datos.json` and
// `/{l}/items/datos.json` (PR5), the files the Pokédex and the Items list read, and the
// comboboxes and the preview wait for them.
//
// Two controls of the design system cannot take `aria-invalid` and `aria-describedby` on the
// element that holds the value: `NumberField` (its input) and `Select` (its trigger) spread
// their extra props on their root. `markInvalid` writes those two attributes on that element
// after each render, from the same errors the other fields take by props. React never renders
// `aria-invalid` there, and it renders `aria-describedby` only with a helper, which this keeps
// first, so neither write is undone.

/** The draft of a visitor (9.7.7). A change of its shape takes a new version of the key. */
const STORAGE_KEY = 'alliance-codex:comercio:borrador:v2';
/** The draft of the free-text form before 16.4.4: removed on arrival, never read. */
const OLD_STORAGE_KEY = 'alliance-codex:comercio:borrador:v1';

/** Limits of the fields of 9.7.2: limits of the form, not game data (Q8). */
const LIMITS = {
  boost: [0, BOOST_MAX],
  starLevel: [0, STAR_LEVEL_MAX],
  memorySlots: [1, MEMORY_SLOTS_MAX],
  level: [0, NIVEL_ENTRENAMIENTO_MAX],
} as const satisfies Record<string, readonly [number, number]>;

/** At most two in-game price options, of different currencies (9.7.4). */
const GAME_OPTIONS_MAX = 2;

/** Longest typed amount or percentage: the 15 digits of 9.4 with their separators. */
const AMOUNT_MAX = 24;

// ------------------------------------------------------------------------------ props

/** A world of content/mundos.json (§8.1), in the order of `getMundos`. */
export interface ListingFormWorld {
  id: string;
  nombre: string;
}

/** An aura of content/auras.json, with its icon resolved (DP2). */
export interface ListingFormAura {
  id: string;
  nombre: string;
  icono: SpriteData | null;
}

/** An addon of content/outfits.json, listed under the Pokémon that owns it (9.7.2). */
export interface ListingFormAddon {
  id: string;
  nombre: string;
  /** Its sprite through the adapter (DP2), or `null` (R11). */
  icono?: SpriteData | null;
}

/** The texts of the pickers and controls of 16.3 (DP1). */
export interface ListingFormPickerLabels {
  picker: PickerLabels;
  filters: PokemonFilterLabels;
  /** «Categoría». */
  category: string;
  /** «¿Qué vendes?». */
  assetQuestion: string;
  /** «Elegir Pokémon», «Elegir Ball», «Elegir ítem», «Elegir held», «Elegir Mega Stone». */
  choosePokemon: string;
  chooseBall: string;
  chooseItem: string;
  chooseHeld: string;
  chooseMega: string;
  /** «Held X», «Held Y», «Mega Stone», «Addons», «Auras». */
  heldX: string;
  heldY: string;
  mega: string;
  addons: string;
  auras: string;
  /** «{n} estrellas». */
  star: string;
}

/** «Vendes como» (board Personajes, Variante 2), `trade.sellAs`. */
export interface ListingFormSellAs {
  label: string;
  /** «Personajes»: the link to the account's characters. */
  characters: string;
  /** «Principal». */
  main: string;
  /** «Elige un personaje». */
  choose: string;
  /** The line beside the locked world, and the one of a Pokédólares listing. */
  worldLocked: string;
  anyWorld: string;
  /** «Aún no tienes personajes…» and «Añadir personaje». */
  empty: string;
  add: string;
  /** «Elige el personaje con el que vendes.». */
  required: string;
}

/** The texts of publishing, of the dialog after it and of «Editar» (board Anuncio-publicado). */
export interface ListingFormPublishing {
  /** «Publicando…», «Guardando…». */
  busy: string;
  saving: string;
  /** «No se pudo publicar:», «No se pudieron guardar los cambios:», «Tus datos siguen…». */
  failed: string;
  saveFailed: string;
  kept: string;
  /** «Reintentar». */
  retry: string;
  /** «Visible en Comercio hasta el {date}.», «Enlace del anuncio». */
  visibleUntil: string;
  link: string;
  /** «Copiar enlace», «Enlace copiado», and the line when the browser does not copy. */
  copyLink: string;
  linkCopied: string;
  copyFailed: string;
  /** «Crear otro anuncio», «Mis anuncios». */
  another: string;
  mine: string;
  /** «Editar anuncio» (the h1 in edit mode), «Guardar cambios». */
  editTitle: string;
  save: string;
  /** The edit mode when the listing cannot be read, or is not the account's. */
  loadFailed: string;
  notEditable: string;
  refusals: RefusalLabels;
}

/**
 * «Publicar anuncio» of phase B (9.7.8, 16.4.4), given only with COMERCIO_PUBLICO. `contact` is
 * the text of the requirement lines, shared with «Contactar al vendedor».
 */
export interface ListingFormPublish {
  /** «Publicar anuncio». */
  publish: string;
  /** «Anuncio publicado»: the title of the dialog. */
  published: string;
  /** «Ver anuncio». */
  view: string;
  sellAs: ListingFormSellAs;
  publishing: ListingFormPublishing;
  /** `/{l}/cuenta/#personajes`, `/{l}/cuenta/anuncios/`, `/{l}/cuenta/`. */
  charactersHref: string;
  listingsHref: string;
  /** «Inicia sesión para publicar». */
  signInLine: string;
  /** «Iniciar sesión». */
  signIn: string;
  contact: Pick<
    ContactSellerLabels,
    | 'account'
    | 'adultsOnly'
    | 'discord'
    | 'discordAge'
    | 'suspendedUntil'
    | 'suspended'
    | 'goToAccount'
  >;
  consent: RealMoneyConsentLabels;
  /** `ui.close`. */
  close: string;
}

/** The sprites of the form (DP2): the four asset tabs and the stages of the preview. */
export interface ListingFormSprites extends ListingPreviewSprites {
  /** The tabs of «Tipo de activo» (9.5.1): `outfits/5`, `items/stones/fire-stone`… */
  tabs: Readonly<Record<TipoActivo, SpriteData | null>>;
}

/** Every text of the form (DP1), composed by the page from its dictionary. */
export interface ListingFormLabels {
  /** «Tipo de activo». */
  assetType: string;
  /** «Pokémon», «Items», «Diamonds», «Pokédólares». */
  types: Readonly<Record<TipoActivo, string>>;
  pokemon: string;
  ball: string;
  aura: string;
  /** «Ninguna»: the aura of a Pokémon without one. */
  auraNone: string;
  boost: string;
  /** «De +0 a +50.». */
  boostHelp: string;
  starLevel: string;
  nickname: string;
  memorySlots: string;
  /** «Memoria {n}». */
  memory: string;
  /** «Held Items»: the legend of the held item fields. */
  heldItems: string;
  /** «Held Item {n}»: the label of each of the HELDS_MAX held item fields (9.4). */
  heldItem: string;
  tier: string;
  addon: string;
  /** «Ninguno»: the addon of a Pokémon without one. */
  addonNone: string;
  /** «Next Boost chance (%)»: a percentage (9.7.2, §12.16). */
  nextBoostChance: string;
  /** «Entrenamiento». */
  training: string;
  /** «Nivel». */
  level: string;
  /** «Progreso (%)»: a percentage (9.7.2). */
  progress: string;
  /** «NPC Price». */
  npcPrice: string;
  /** «Sin declarar». */
  npcNone: string;
  /** «Unsellable». */
  npcUnsellable: string;
  /** «Importe». */
  amount: string;
  /** «Item». */
  item: string;
  /** «Cantidad». */
  quantity: string;
  /** «Precio». */
  price: string;
  /** «Dinero real». */
  fiat: string;
  /** «Moneda». */
  currency: string;
  /** «En el juego». */
  game: string;
  /** «Quitar opción». */
  removeOption: string;
  /** «Añadir otra opción». */
  addOption: string;
  /** «A convenir». */
  negotiable: string;
  /** «Mundo». */
  world: string;
  /** The price per unit (`trade.unitPrice`). */
  unitPrice: UnitPriceLabels & {
    mode: string;
    total: string;
    perUnit: string;
    unit: string;
    unitHelp: string;
    totalLine: string;
    noTotal: string;
  };
  /** The name of the preview region, «Vista previa». */
  preview: string;
  /** The hints under the row names of the trays (`Lienzo:Crear-anuncio`); a row without one
   * draws its name alone. */
  hints?: ListingFormHints;
  errors: ListingFormErrors;
}

/** The hint lines of the label column. */
export interface ListingFormHints {
  /** «Opcional»: Ball. */
  optional?: string;
  /** «Varias»: Auras. */
  auras?: string;
  /** «Varios»: Addons. */
  addons?: string;
  /** «Opcionales»: Held Items. */
  held?: string;
  /** «Nivel y progreso»: Entrenamiento. */
  training?: string;
}

/**
 * The messages of 9.7.5, `trade.form.errors` of the dictionary. Its table has no line for an
 * items listing without its item (9.7.3), and every invalid field carries its own message
 * (§12.16): `item` is that line.
 */
export interface ListingFormErrors {
  /** «Elige un Pokémon de la lista.». */
  pokemon: string;
  /** «Escribe un número de {min} a {max}.». */
  range: string;
  /** «Escribe un porcentaje de 0 a 100, con hasta 2 decimales.». */
  percent: string;
  /** «Escribe una cantidad entera mayor que cero.». */
  quantity: string;
  /** «Esa cantidad no es un número entero de Pokédólares.». */
  pokedolaresFraction: string;
  /** «Indica un precio o marca «A convenir».». */
  noPrice: string;
  /** «Esa opción de precio no es válida para este anuncio.». */
  priceOption: string;
  /** «Elige un mundo.». */
  world: string;
  /** «Elige un ítem.»: an items listing without its item. */
  item: string;
}

/**
 * The texts of the preview card that `ui` does not carry: the card's own (DS:ListingCard), with
 * the label of each fact key, and the two of 9.7.6 and 9.5.8.
 */
export interface ListingFormCardLabels {
  card: Omit<ListingPreviewLabels['card'], 'shiny' | 'money'>;
  /** «ahora» / «now»: the meta of a listing not published yet (9.7.6). */
  now: string;
  /** «Unsellable»: the NPC Price of a Pokémon the NPC does not buy, a game term. */
  unsellable: string;
  /** «Cualquier mundo»: the tag of a Pokédólares listing. */
  anyWorld?: string;
}

/**
 * The part of `messages.ui` the island reads (13.2): the strip and the joining word of the
 * panels, «Shiny», the rows of the panels, the money components, «Nº {n}», the names of the
 * steppers, the close button of the Notice and the line of a data file that did not load. The
 * rest of the namespace (views, pagination, dialogs) would only weigh on the props (13.6).
 */
export type ListingFormUi = Pick<
  Messages['ui'],
  | 'pinHint'
  | 'or'
  | 'shiny'
  | 'tooltip'
  | 'money'
  | 'decrease'
  | 'increase'
  | 'dismiss'
  | 'dataError'
> & { cards: Pick<Messages['ui']['cards'], 'number'> };

export interface ListingFormProps {
  locale: Locale;
  /** `/{l}/pokedex/datos.json` (PR5): the roster of the Pokémon and of the memories. */
  pokedexUrl: string;
  /** `/{l}/items/datos.json` (PR5): the items, the Balls and the held items. */
  itemsUrl: string;
  worlds: readonly ListingFormWorld[];
  auras: readonly ListingFormAura[];
  /** The addons of each Pokémon that has some, by its id (9.7.2). */
  addons: Readonly<Record<string, readonly ListingFormAddon[]>>;
  /** `nombre` of each Market category, by id, in the page's language. */
  categories: Readonly<Record<string, string>>;
  sprites: ListingFormSprites;
  /** The Diamonds panel and the two lists of their `moneda` object (§3.13, 7.5.3). */
  diamonds: ListingPreviewDiamonds;
  labels: ListingFormLabels;
  /** The texts of the preview card. */
  preview: ListingFormCardLabels;
  /** The pickers and controls of 16.3. */
  pickers: ListingFormPickerLabels;
  /** Phase B: «Publicar anuncio»; absent in phase A. */
  publish?: ListingFormPublish | null;
  /** `messages.ui` of the page's locale, the part the island reads (13.2). */
  ui: ListingFormUi;
}

// ------------------------------------------------------------------------------ draft

type NpcChoice = 'none' | 'unsellable' | 'amount';

const NPC_CHOICES: readonly NpcChoice[] = ['none', 'unsellable', 'amount'];

interface TrainingRow {
  level: number | null;
  progress: string;
}

interface PokemonDraft {
  pokemon: string | null;
  nickname: string;
  ball: string | null;
  auras: string[];
  addons: string[];
  heldX: string | null;
  heldY: string | null;
  mega: string | null;
  boost: number | null;
  starLevel: number | null;
  memorySlots: number | null;
  /** MEMORY_SLOTS_MAX entries; the first `memorySlots` are shown. */
  memories: (string | null)[];
  nextBoostChance: string;
  /** One row per skill, in the order of HABILIDADES. */
  training: TrainingRow[];
  npc: NpcChoice;
  npcAmount: string;
}

interface GameRow {
  kind: MonedaJuego;
  amount: string;
}

type PriceMode = 'total' | 'unit';

const PRICE_MODES: readonly PriceMode[] = ['total', 'unit'];

interface PriceDraft {
  negotiable: boolean;
  currency: MonedaReal;
  real: string;
  /** 1 or 2 rows; a row without an amount is no option. */
  game: GameRow[];
  /** «Total» or «Por unidad» (Items, Diamonds and Pokédólares only). */
  mode: PriceMode;
  /** The unit of a price per unit, as typed: «1», «10», «1kk». */
  unit: string;
}

interface Draft {
  tipo: TipoActivo;
  pokemon: PokemonDraft;
  item: { id: string | null; quantity: string };
  diamonds: string;
  pokedolares: string;
  price: PriceDraft;
  /** World id, or '' while none is chosen (phase A; phase B takes the character's). */
  world: string;
  /** «Vendes como»: `account_characters.id`, or '' while none is chosen (phase B). */
  characterId: string;
}

/** The other in-game currency. */
function other(kind: MonedaJuego): MonedaJuego {
  return kind === 'pokedolares' ? 'diamonds' : 'pokedolares';
}

/**
 * An empty price option: Pokédólares, or Diamonds for a listing of Pokédólares, which cannot be
 * priced in its own asset (9.7.4, rule 3).
 */
function emptyRow(tipo: TipoActivo): GameRow {
  return { kind: tipo === 'pokedolares' ? 'diamonds' : 'pokedolares', amount: '' };
}

function emptyDraft(): Draft {
  return {
    tipo: TIPOS_ACTIVO[0],
    pokemon: {
      pokemon: null,
      nickname: '',
      ball: null,
      auras: [],
      addons: [],
      heldX: null,
      heldY: null,
      mega: null,
      boost: null,
      starLevel: null,
      memorySlots: null,
      memories: Array.from({ length: MEMORY_SLOTS_MAX }, () => null),
      nextBoostChance: '',
      training: HABILIDADES.map(() => ({ level: null, progress: '' })),
      npc: 'none',
      npcAmount: '',
    },
    item: { id: null, quantity: '' },
    diamonds: '',
    pokedolares: '',
    price: {
      negotiable: false,
      currency: MONEDAS_REALES[0],
      real: '',
      game: [emptyRow('pokemon')],
      mode: 'total',
      unit: '',
    },
    world: '',
    characterId: '',
  };
}

// The stored draft is read field by field: a value of another shape falls back to the empty
// one, so a draft written by another version of the form never breaks the page.

type Loose = Record<string, unknown>;

function isObject(value: unknown): value is Loose {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looseText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function looseWhole(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function looseOneOf<Value extends string>(
  value: unknown,
  options: readonly Value[],
  fallback: Value,
): Value {
  return options.find((option) => option === value) ?? fallback;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A registry id of a stored draft, or `null`. */
function looseId(value: unknown): string | null {
  return typeof value === 'string' && SLUG.test(value) ? value : null;
}

/** Distinct registry ids of a stored draft. */
function looseIds(value: unknown): string[] {
  const ids = Array.isArray(value) ? value.flatMap((entry) => looseId(entry) ?? []) : [];
  return [...new Set(ids)].slice(0, 32);
}

function looseList<Entry>(value: unknown, length: number, read: (entry: Loose) => Entry): Entry[] {
  const entries = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => {
    const entry: unknown = entries[index];
    return read(isObject(entry) ? entry : {});
  });
}

function restoreDraft(stored: unknown): Draft | null {
  if (!isObject(stored)) return null;
  const base = emptyDraft();
  const unit = isObject(stored.pokemon) ? stored.pokemon : {};
  const item = isObject(stored.item) ? stored.item : {};
  const price = isObject(stored.price) ? stored.price : {};
  const tipo = looseOneOf(stored.tipo, TIPOS_ACTIVO, base.tipo);
  const game = (Array.isArray(price.game) ? price.game : [])
    .slice(0, GAME_OPTIONS_MAX)
    .map((row: unknown): GameRow => {
      const entry = isObject(row) ? row : {};
      return {
        kind: looseOneOf(entry.kind, MONEDAS_JUEGO, 'pokedolares'),
        amount: looseText(entry.amount, AMOUNT_MAX),
      };
    });
  return {
    tipo,
    pokemon: {
      pokemon: looseId(unit.pokemon),
      nickname: looseText(unit.nickname, NOMBRE_MAX),
      ball: looseId(unit.ball),
      auras: looseIds(unit.auras),
      addons: looseIds(unit.addons),
      heldX: looseId(unit.heldX),
      heldY: looseId(unit.heldY),
      mega: looseId(unit.mega),
      boost: looseWhole(unit.boost),
      starLevel: looseWhole(unit.starLevel),
      memorySlots: looseWhole(unit.memorySlots),
      memories: Array.from({ length: MEMORY_SLOTS_MAX }, (_, index) =>
        looseId(Array.isArray(unit.memories) ? unit.memories[index] : undefined),
      ),
      nextBoostChance: looseText(unit.nextBoostChance, AMOUNT_MAX),
      training: looseList(unit.training, HABILIDADES.length, (entry) => ({
        level: looseWhole(entry.level),
        progress: looseText(entry.progress, AMOUNT_MAX),
      })),
      npc: looseOneOf(unit.npc, NPC_CHOICES, 'none'),
      npcAmount: looseText(unit.npcAmount, AMOUNT_MAX),
    },
    item: {
      id: looseId(item.id),
      quantity: looseText(item.quantity, AMOUNT_MAX),
    },
    diamonds: looseText(stored.diamonds, AMOUNT_MAX),
    pokedolares: looseText(stored.pokedolares, AMOUNT_MAX),
    price: {
      negotiable: price.negotiable === true,
      currency: looseOneOf(price.currency, MONEDAS_REALES, base.price.currency),
      real: looseText(price.real, AMOUNT_MAX),
      game: game.length > 0 ? game : [emptyRow(tipo)],
      mode: looseOneOf(price.mode, PRICE_MODES, 'total'),
      unit: looseText(price.unit, AMOUNT_MAX),
    },
    world: looseId(stored.world) ?? '',
    characterId:
      typeof stored.characterId === 'string' && UUID.test(stored.characterId)
        ? stored.characterId
        : '',
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A typed amount the form writes back: «50kk», «1.500», «1.80». */
function typedAmount(value: number, kind: MonedaJuego | 'whole', locale: Locale): string {
  if (kind === 'pokedolares') return compactKks(value) ?? formatInteger(value, locale);
  return formatInteger(value, locale);
}

/** A listing of the account as the draft of «Editar» (owner rule 2026-09-24). */
function draftFromListing(anuncio: Anuncio, locale: Locale): Draft {
  const base = emptyDraft();
  const per = anuncio.tipo === 'pokemon' ? null : (anuncio.precio.porUnidad ?? null);
  const shown = per ?? anuncio.precio;
  const real: PrecioReal | null = shown.real;
  const game = shown.juego.map((option) => ({
    kind: option.tipo,
    amount: typedAmount(option.cantidad, option.tipo, locale),
  }));
  const unit = anuncio.pokemon;
  const draft: Draft = {
    ...base,
    tipo: anuncio.tipo,
    world: anuncio.mundo,
    characterId: anuncio.character?.id ?? '',
    price: {
      negotiable: anuncio.precio.aConvenir,
      currency: real?.moneda ?? base.price.currency,
      real: real?.importe ?? '',
      game: game.length > 0 ? game : [emptyRow(anuncio.tipo)],
      mode: per === null ? 'total' : 'unit',
      unit:
        per === null
          ? ''
          : typedAmount(
              per.cantidad,
              anuncio.tipo === 'pokedolares' ? 'pokedolares' : 'whole',
              locale,
            ),
    },
  };
  if (anuncio.tipo === 'pokemon' && unit !== undefined) {
    draft.pokemon = {
      ...base.pokemon,
      pokemon: unit.pokemon,
      nickname: unit.nickname ?? '',
      ball: unit.ball,
      auras: [...unit.auras],
      addons: [...unit.addons],
      heldX: unit.heldX,
      heldY: unit.heldY,
      mega: unit.mega,
      boost: unit.boost,
      starLevel: unit.starLevel,
      memorySlots: unit.memorySlots,
      memories: Array.from(
        { length: MEMORY_SLOTS_MAX },
        (_, index) => unit.memorias[index] ?? null,
      ),
      nextBoostChance: unit.nextBoostChance ?? '',
      training: HABILIDADES.map((habilidad) => {
        const entry = unit.entrenamiento.find((row) => row.habilidad === habilidad);
        return { level: entry?.nivel ?? null, progress: entry?.progreso ?? '' };
      }),
      npc:
        unit.precioNpc === null
          ? 'none'
          : unit.precioNpc.tipo === 'unsellable'
            ? 'unsellable'
            : 'amount',
      npcAmount:
        unit.precioNpc?.tipo === 'pokedolares'
          ? typedAmount(unit.precioNpc.cantidad, 'pokedolares', locale)
          : '',
    };
  } else if (anuncio.tipo === 'items' && anuncio.item !== undefined) {
    draft.item = {
      id: anuncio.item.item,
      quantity: typedAmount(anuncio.item.cantidad, 'whole', locale),
    };
  } else if (anuncio.tipo === 'diamonds' && anuncio.cantidad !== undefined) {
    draft.diamonds = typedAmount(anuncio.cantidad, 'whole', locale);
  } else if (anuncio.tipo === 'pokedolares' && anuncio.cantidad !== undefined) {
    draft.pokedolares = typedAmount(anuncio.cantidad, 'pokedolares', locale);
  }
  return draft;
}

function readStoredDraft(): Draft | null {
  try {
    window.localStorage.removeItem(OLD_STORAGE_KEY);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : restoreDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

function storeDraft(draft: Draft): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // No storage (a private window, blocked site data, a full quota): the form works the same.
  }
}

// ------------------------------------------------------------------------------ data

/** A data file of the page, read once hydrated (PR5). */
type Loaded<Data> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: Data };

/** Records by id, in the order of the file. */
interface Catalogue<Row> {
  rows: readonly Row[];
  byId: ReadonlyMap<string, Row>;
}

interface Roster extends Catalogue<PokedexRow> {
  elements: PokedexElementRefs;
}

interface Items extends Catalogue<ItemsRow> {
  refs: ItemsData['refs'];
}

function catalogue<Row extends { id: string }>(rows: readonly Row[]): Catalogue<Row> {
  return { rows, byId: new Map(rows.map((row) => [row.id, row])) };
}

function readRoster(json: unknown): Roster {
  return { ...catalogue(decodePokedex(json)), elements: decodeRefs(json).elementos };
}

function readItems(json: unknown): Items {
  return { ...catalogue(decodeItems(json)), refs: decodeItemsRefs(json) };
}

/** One data file, fetched once per URL after hydration; its reader is a module function. */
function useData<Data>(url: string, read: (json: unknown) => Data): Loaded<Data> {
  const [loaded, setLoaded] = useState<Loaded<Data>>({ state: 'loading' });
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((json) => {
        if (alive) setLoaded({ state: 'ready', data: read(json) });
      })
      .catch(() => {
        if (alive) setLoaded({ state: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [url, read]);
  return loaded;
}

// ------------------------------------------------------------------------ the listing

/** Tier of a held item row (16.2.3), or `undefined`. */
function heldTierOf(row: object): number | undefined {
  const held = (row as { held?: { tier?: unknown } | null }).held;
  return typeof held?.tier === 'number' ? held.tier : undefined;
}

/** A whole number within its limits, or `null`. */
function within(value: number | null, [min, max]: readonly [number, number]): number | null {
  return value !== null && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** A valid optional percentage as §9.4 keeps it, with a point: «53», «12.5». */
function percent(typed: string): string | null {
  const value = typed.trim();
  if (value === '' || !isValidOptionalPercent(value)) return null;
  return value.replace(',', '.');
}

interface Context {
  locale: Locale;
  roster: Roster | null;
  addons: ListingFormProps['addons'];
}

/** What the draft says, once read (9.4): only the valid values of its fields. */
interface Reading {
  anuncio: ListingPreviewDraft;
  /** The chosen Pokémon is Ditto or Shiny Ditto (9.7.2). */
  ditto: boolean;
  /** The addons of the chosen Pokémon (9.7.2). */
  addons: readonly ListingFormAddon[];
}

/** The in-game options of the price that are valid for the listing (9.7.4, rules 2 and 3). */
function gameOptions(draft: Draft, locale: Locale): OpcionJuego[] {
  const [first] = draft.price.game;
  return draft.price.game.flatMap((row, index) => {
    if (row.kind === draft.tipo || (index > 0 && row.kind === first.kind)) return [];
    const amount = parsePrice(row.amount, row.kind, locale);
    return amount === null ? [] : [{ tipo: row.kind, cantidad: amount }];
  });
}

/** The quantity of the asset as typed, once it reads: what a price per unit multiplies. */
function quantityOf(draft: Draft, locale: Locale): number | null {
  if (draft.tipo === 'items') return parsePositiveWhole(draft.item.quantity, locale);
  if (draft.tipo === 'diamonds') return parsePositiveWhole(draft.diamonds, locale);
  if (draft.tipo === 'pokedolares') return parsePrice(draft.pokedolares, 'pokedolares', locale);
  return null;
}

/** The unit of a price per unit, once it reads: «1kk» of Pokédólares, a whole count otherwise. */
function unitOf(draft: Draft, locale: Locale): number | null {
  if (draft.tipo === 'pokedolares') return parsePrice(draft.price.unit, 'pokedolares', locale);
  return parsePositiveWhole(draft.price.unit, locale);
}

/** Whether the draft is priced per unit: «Por unidad» on a listing with a quantity. */
function perUnit(draft: Draft): boolean {
  return draft.price.mode === 'unit' && hasUnitPrice(draft.tipo) && !draft.price.negotiable;
}

function readPrice(draft: Draft, locale: Locale): Precio {
  const { price } = draft;
  if (price.negotiable) return { real: null, juego: [], aConvenir: true };
  const amount = parsePrice(price.real, price.currency, locale);
  const real =
    amount === null
      ? null
      : { moneda: price.currency, importe: price.real.trim().replace(',', '.') };
  const juego = gameOptions(draft, locale);
  if (!perUnit(draft)) return { real, juego, aConvenir: false };
  // A price per unit: the totals once the unit and the quantity read (unit-price.ts).
  const unit = unitOf(draft, locale);
  const quantity = quantityOf(draft, locale);
  if (unit !== null && quantity !== null) {
    const priced = priceFromUnit(unit, real, juego, quantity);
    if (priced !== null) return priced;
  }
  return {
    real: null,
    juego: [],
    aConvenir: false,
    porUnidad: unit === null ? null : { cantidad: unit, real, juego },
  };
}

function readUnit(
  unit: PokemonDraft,
  context: Context,
): Omit<Reading, 'anuncio'> & {
  pokemon: UnidadPokemon;
} {
  const { roster, locale } = context;
  const known = (id: string | null) =>
    id !== null && (roster === null || roster.byId.has(id)) ? id : null;
  const id = known(unit.pokemon);
  const ditto = isDittoSlug(id);
  const addons = id === null ? [] : (context.addons[id] ?? []);
  const slots = ditto ? within(unit.memorySlots, LIMITS.memorySlots) : null;
  const nickname = unit.nickname.trim();
  const npcAmount = unit.npc === 'amount' ? parsePokedolares(unit.npcAmount, locale) : null;

  return {
    ditto,
    addons,
    pokemon: {
      pokemon: id ?? '',
      ball: unit.ball,
      auras: unit.auras,
      // 9.7.2: only the addons of the chosen Pokémon.
      addons: unit.addons.filter((addon) => addons.some((own) => own.id === addon)),
      heldX: unit.heldX,
      heldY: unit.heldY,
      mega: unit.mega,
      boost: within(unit.boost, LIMITS.boost),
      starLevel: within(unit.starLevel, LIMITS.starLevel),
      nickname: nickname === '' ? null : nickname,
      memorySlots: slots,
      memorias: slots === null ? [] : unit.memories.slice(0, slots).map(known),
      nextBoostChance: percent(unit.nextBoostChance),
      entrenamiento: HABILIDADES.flatMap((habilidad, index) => {
        const row = unit.training[index];
        const nivel = within(row.level, LIMITS.level);
        const progreso = percent(row.progress);
        return nivel === null && progreso === null ? [] : [{ habilidad, nivel, progreso }];
      }),
      precioNpc:
        unit.npc === 'unsellable'
          ? { tipo: 'unsellable' }
          : npcAmount?.ok === true
            ? { tipo: 'pokedolares', cantidad: npcAmount.valor }
            : null,
    },
  };
}

/** The listing the draft describes (9.4). An unknown amount is `NaN`, never 0 (G7). */
function readDraft(draft: Draft, context: Context): Reading {
  const { locale } = context;
  const base = { tipo: draft.tipo, precio: readPrice(draft, locale), mundo: draft.world };
  if (draft.tipo === 'pokemon') {
    const { pokemon, ditto, addons } = readUnit(draft.pokemon, context);
    return { anuncio: { ...base, pokemon }, ditto, addons };
  }
  if (draft.tipo === 'items') {
    const cantidad = parsePositiveWhole(draft.item.quantity, locale) ?? Number.NaN;
    const item = draft.item.id === null ? {} : { item: { item: draft.item.id, cantidad } };
    return { anuncio: { ...base, ...item }, ditto: false, addons: [] };
  }
  const cantidad =
    draft.tipo === 'diamonds'
      ? parsePositiveWhole(draft.diamonds, locale)
      : parsePrice(draft.pokedolares, 'pokedolares', locale);
  return { anuncio: { ...base, cantidad: cantidad ?? Number.NaN }, ditto: false, addons: [] };
}

// ------------------------------------------------------------------------------ errors

type Errors = Readonly<Record<string, string>>;

interface Validation {
  errors: Errors;
  /** The ids of the fields in the order of the page: the focus goes to the first invalid one. */
  order: readonly string[];
}

/** The ids of the fields: the target of the focus and the base of the id of the error line. */
const ID = {
  pokemon: 'lf-pokemon',
  nickname: 'lf-nickname',
  ball: 'lf-ball',
  boost: 'lf-boost',
  starLevel: 'lf-star-level',
  memorySlots: 'lf-memory-slots',
  memory: (index: number) => `lf-memory-${index}`,
  nextBoostChance: 'lf-next-boost',
  trainLevel: (index: number) => `lf-train-${index}-level`,
  trainProgress: (index: number) => `lf-train-${index}-progress`,
  npcAmount: 'lf-npc-amount',
  item: 'lf-item',
  itemQuantity: 'lf-item-quantity',
  diamonds: 'lf-diamonds',
  pokedolares: 'lf-pokedolares',
  currency: 'lf-currency',
  real: 'lf-real',
  gameKind: (index: number) => `lf-game-${index}-kind`,
  gameAmount: (index: number) => `lf-game-${index}-amount`,
  addOption: 'lf-add-option',
  negotiable: 'lf-negotiable',
  priceMode: 'lf-price-mode',
  unit: 'lf-unit',
  world: 'lf-world',
  character: 'lf-character',
  type: 'lf-type',
  publish: 'lf-publish',
  link: 'lf-link',
} as const;

/** The fields of the in-game price options, whose position moves when one is removed. */
const GAME_FIELD = /^lf-game-/;

function errorId(id: string): string {
  return `${id}-error`;
}

/**
 * The error of every field of the draft (9.7.5), whether it shows yet or not, and the order of
 * the fields. An items listing without its item takes `errors.item`, the line the table of 9.7.5
 * does not have; a real price that is not an amount is no price, and takes the line of a listing
 * without one.
 */
/** What the phase asks besides the fields: a world (phase A) or a character (phase B). */
interface Seller {
  /** Worlds offered in phase A; 0 in phase B. */
  worlds: number;
  /** Phase B: «Elige el personaje con el que vendes.»; null in phase A. */
  character: string | null;
  /** «Con esa unidad el precio no da un total válido.». */
  noTotal: string;
}

function validate(
  draft: Draft,
  reading: Reading,
  context: Context,
  messages: ListingFormErrors,
  seller: Seller,
): Validation {
  const { locale } = context;
  const errors: Record<string, string> = {};
  const order: string[] = [];
  const check = (id: string, message: string | null) => {
    order.push(id);
    if (message !== null) errors[id] = message;
  };
  if (seller.character !== null) {
    check(ID.character, draft.characterId === '' ? seller.character : null);
  }
  const range = ([min, max]: readonly [number, number]) =>
    fill(messages.range, { min: formatInteger(min, locale), max: formatInteger(max, locale) });
  const number = (value: number | null, limits: readonly [number, number], required = false) =>
    value === null
      ? required
        ? range(limits)
        : null
      : within(value, limits) === null
        ? range(limits)
        : null;
  const pokedolares = (typed: string) => {
    const parsed = parsePokedolares(typed, locale);
    if (parsed.ok) return null;
    return parsed.motivo === 'fraccion' ? messages.pokedolaresFraction : messages.quantity;
  };
  const whole = (typed: string) =>
    parsePositiveWhole(typed, locale) === null ? messages.quantity : null;
  const ratio = (typed: string) => (isValidOptionalPercent(typed) ? null : messages.percent);

  if (draft.tipo === 'pokemon') {
    const unit = draft.pokemon;
    check(ID.pokemon, reading.anuncio.pokemon?.pokemon ? null : messages.pokemon);
    check(ID.nickname, null);
    check(ID.ball, null);
    check(ID.boost, number(unit.boost, LIMITS.boost));
    check(ID.starLevel, number(unit.starLevel, LIMITS.starLevel));
    if (reading.ditto) {
      check(ID.memorySlots, number(unit.memorySlots, LIMITS.memorySlots, true));
    }
    check(ID.nextBoostChance, ratio(unit.nextBoostChance));
    unit.training.forEach((row, index) => {
      check(ID.trainLevel(index), number(row.level, LIMITS.level));
      check(ID.trainProgress(index), ratio(row.progress));
    });
    if (unit.npc === 'amount') check(ID.npcAmount, pokedolares(unit.npcAmount));
  } else if (draft.tipo === 'items') {
    check(ID.item, draft.item.id === null ? messages.item : null);
    check(ID.itemQuantity, whole(draft.item.quantity));
  } else if (draft.tipo === 'diamonds') {
    check(ID.diamonds, whole(draft.diamonds));
  } else {
    check(ID.pokedolares, pokedolares(draft.pokedolares));
  }

  const { price } = draft;
  if (perUnit(draft)) {
    const unit = unitOf(draft, locale);
    const priced = reading.anuncio.precio;
    const typed = price.real.trim() !== '' || price.game.some((row) => row.amount.trim() !== '');
    check(
      ID.unit,
      unit === null
        ? draft.tipo === 'pokedolares'
          ? pokedolares(price.unit)
          : messages.quantity
        : typed &&
            quantityOf(draft, locale) !== null &&
            priced.real === null &&
            priced.juego.length === 0
          ? seller.noTotal
          : null,
    );
  }
  if (!price.negotiable) {
    const typedReal = price.real.trim() !== '';
    const realAmount = parsePrice(price.real, price.currency, locale);
    const typedGame = price.game.some((row) => row.amount.trim() !== '');
    check(ID.currency, null);
    check(
      ID.real,
      (typedReal && realAmount === null) || (!typedReal && !typedGame) ? messages.noPrice : null,
    );
    const [first] = price.game;
    price.game.forEach((row, index) => {
      const invalid = row.kind === draft.tipo || (index > 0 && row.kind === first.kind);
      check(ID.gameKind(index), invalid ? messages.priceOption : null);
      if (row.amount.trim() === '') check(ID.gameAmount(index), null);
      else
        check(
          ID.gameAmount(index),
          row.kind === 'pokedolares' ? pokedolares(row.amount) : whole(row.amount),
        );
    });
  }
  if (seller.character === null && seller.worlds > 0) {
    check(ID.world, draft.world === '' ? messages.world : null);
  }
  return { errors, order };
}

/**
 * `aria-invalid` and the error line on the element of a `NumberField` or a `Select` that holds
 * the value, which neither takes by props (see the head of this file). The helper line of a
 * NumberField keeps its place first in `aria-describedby`.
 */
function markInvalid(form: HTMLFormElement, errors: Errors): void {
  const controls = form.querySelectorAll<HTMLElement>(
    '.ac-number-field__input[id], .ac-select__trigger[id]',
  );
  for (const control of controls) {
    const message = errors[control.id];
    const helper = `${control.id}-helper`;
    const described = document.getElementById(helper) === null ? [] : [helper];
    if (message === undefined) {
      control.removeAttribute('aria-invalid');
    } else {
      control.setAttribute('aria-invalid', 'true');
      if (message !== '') described.push(errorId(control.id));
    }
    if (described.length === 0) control.removeAttribute('aria-describedby');
    else control.setAttribute('aria-describedby', described.join(' '));
  }
}

// ------------------------------------------------------------------------------ view

interface FieldProps {
  id: string;
  error?: string;
  /** The width of a slot trigger (312): a picker or a text of one line. */
  slot?: boolean;
  /** The width of a short figure (152): a percentage, a quantity. */
  narrow?: boolean;
  children: ReactNode;
}

/** A field and the error line under it (9.7.5). */
function Field({ id, error, slot = false, narrow = false, children }: FieldProps) {
  return (
    <div
      className={[
        'ac-listing-form__field',
        slot ? 'ac-listing-form__field--slot' : null,
        narrow ? 'ac-listing-form__field--narrow' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
      {error === undefined || error === '' ? null : (
        <p id={errorId(id)} className="ac-listing-form__error">
          {error}
        </p>
      )}
    </div>
  );
}

interface RowProps {
  /** The name in the label column; the control keeps its own accessible name. */
  label: string;
  /** The line under the name: «Opcional», «De +0 a +50.». */
  hint?: string;
  /** The row groups several controls: it becomes a `group` named by its label. */
  group?: boolean;
  /** Aligns the label with the first line of a tall control (the training table). */
  top?: boolean;
  children: ReactNode;
}

/**
 * A row of a tray of `Lienzo:Crear-anuncio`: the label column of 128 (the name, 12/16 700,
 * over its hint) and the controls, every row of a tray one line apart.
 */
function Row({ label, hint, group = false, top = false, children }: RowProps) {
  const nameId = useId();
  return (
    <div
      className={top ? 'ac-listing-form__row ac-listing-form__row--top' : 'ac-listing-form__row'}
      role={group ? 'group' : undefined}
      aria-labelledby={group ? nameId : undefined}
    >
      <div className="ac-listing-form__row-label">
        {label === '' ? null : (
          <span
            id={nameId}
            className="ac-listing-form__row-name"
            aria-hidden={group ? undefined : true}
          >
            {label}
          </span>
        )}
        {hint ? <span className="ac-listing-form__row-hint">{hint}</span> : null}
      </div>
      <div className="ac-listing-form__row-control">{children}</div>
    </div>
  );
}

/**
 * What «Publicar anuncio» needs (9.7.8): the Supabase calls, their error texts, the contact
 * requirement and the consent dialog. Nothing of it draws the first paint, so it is one
 * deferred chunk (13.6), asked for when the reader publishes or the dialog opens.
 */
function publishModules() {
  return Promise.all([
    import('@/lib/supabase/trade'),
    import('@/lib/supabase/errors'),
    import('./RealMoneyConsent'),
  ]);
}

const RealMoneyConsent = lazy(() =>
  import('./RealMoneyConsent').then((module) => ({ default: module.RealMoneyConsent })),
);

/** The preview, a chunk of its own that the first render never needs (13.6, 9.7.6). */
const ListingPreview = lazy(() =>
  import('./ListingPreview').then((module) => ({ default: module.ListingPreview })),
);

/** The account's characters for «Vendes como» (phase B). */
type Characters =
  | { state: 'off' }
  | { state: 'loading' }
  | { state: 'signed-out' }
  | { state: 'error' }
  | { state: 'ready'; list: AccountCharacter[] };

/** A publish or a save that failed (board Anuncio-publicado): its line and whether to retry. */
interface Failure {
  text: string;
  toListings: boolean;
  toAccount: boolean;
  retry: boolean;
}

/** A published listing: the dialog after «Publicar anuncio» shows it. */
interface Published {
  id: string;
  until: Date;
  draft: ListingPreviewDraft;
  character: string | null;
}

/** «Editar» (`?editar={id}`): the listing being edited, once read. */
type Editing =
  | { state: 'none' }
  | { state: 'loading'; id: string }
  | { state: 'ready'; id: string }
  | { state: 'error'; id: string; text: string };

type LinkCopy = 'idle' | 'copied' | 'failed';

/** How long «Enlace copiado» stays before the button reads «Copiar enlace» again. */
const COPIED_MS = 2000;

/** The listing id of `?editar=`, or null. */
function editTarget(): string | null {
  const id = new URLSearchParams(window.location.search).get('editar');
  return id !== null && UUID.test(id) ? id : null;
}

export function ListingForm(props: ListingFormProps) {
  const { locale, labels, ui, sprites, worlds, auras, addons, pickers } = props;
  const texts = props.publish ?? null;
  const roster = useData(props.pokedexUrl, readRoster);
  const items = useData(props.itemsUrl, readItems);
  const rosterData = roster.state === 'ready' ? roster.data : null;
  const itemsData = items.state === 'ready' ? items.data : null;
  // The rest of every panel of the pickers and the preview (`/{l}/paneles.json`), once here.
  const panels = usePanels(locale);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [publishing, setPublishing] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [published, setPublished] = useState<Published | null>(null);
  const [linkCopy, setLinkCopy] = useState<LinkCopy>('idle');
  const [characters, setCharacters] = useState<Characters>(() =>
    texts === null ? { state: 'off' } : { state: 'loading' },
  );
  const [editing, setEditing] = useState<Editing>({ state: 'none' });
  const editId = editing.state === 'none' ? null : editing.id;
  const [blocker, setBlocker] = useState<ContactMessage | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [focusNext, setFocusNext] = useState<string | null>(null);
  /** Text fields the reader changed and has not left yet: they validate on leaving. */
  const changed = useRef(new Set<string>());
  /** The reader changed the draft: from then on every change is stored. */
  const edited = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  // The registries of the props, by id: they never change once the page is built.
  const auraNames = useMemo(
    () => Object.fromEntries(auras.map((aura) => [aura.id, aura.nombre])),
    [auras],
  );
  const auraEntities = useMemo(
    () => Object.fromEntries(auras.map((aura) => [aura.id, aura])),
    [auras],
  );
  const addonEntities = useMemo(
    () =>
      Object.fromEntries(
        Object.values(addons)
          .flat()
          .map((addon) => [addon.id, { nombre: addon.nombre, icono: addon.icono ?? null }]),
      ),
    [addons],
  );
  const worldNames = useMemo(
    () => Object.fromEntries(worlds.map((world) => [world.id, world.nombre])),
    [worlds],
  );
  const addonNames = useMemo(
    () =>
      new Map(
        Object.values(addons)
          .flat()
          .map((addon) => [addon.id, addon.nombre]),
      ),
    [addons],
  );

  // The stored draft replaces the empty one once hydrated (9.7.7): the server renders the empty
  // form, so hydration renders it too. «Editar» reads the listing instead, and never touches
  // the stored draft of a new listing.
  useEffect(() => {
    const target = texts === null ? null : editTarget();
    if (target !== null) {
      setEditing({ state: 'loading', id: target });
      return;
    }
    const stored = readStoredDraft();
    if (stored === null) return;
    setDraft(stored);
  }, [texts]);

  useEffect(() => {
    if (edited.current && editId === null) storeDraft(draft);
  }, [draft, editId]);

  // «Vendes como»: the account's characters, read once hydrated. Without a stored session there
  // is nobody to read (the header's session, src/lib/account/session-cache.ts): supabase-js is not
  // even loaded.
  useEffect(() => {
    if (texts === null) return undefined;
    if (readStoredSession() === null) {
      setCharacters({ state: 'signed-out' });
      return undefined;
    }
    let alive = true;
    void (async () => {
      try {
        const client = await getSupabaseBrowserClient();
        const session = client === null ? null : (await client.auth.getSession()).data.session;
        if (client === null || session === null) {
          if (alive) setCharacters({ state: 'signed-out' });
          return;
        }
        const [trade] = await publishModules();
        const listed = await trade.listMyCharacters(client);
        if (!alive) return;
        setCharacters(
          listed.data === null ? { state: 'error' } : { state: 'ready', list: listed.data },
        );
      } catch {
        if (alive) setCharacters({ state: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [texts]);

  // The main character is chosen until the reader picks another one; a stored character the
  // account no longer has falls back to it.
  const characterList = characters.state === 'ready' ? characters.list : null;
  useEffect(() => {
    if (characterList === null || characterList.length === 0) return;
    setDraft((current) => {
      const own = characterList.find((character) => character.id === current.characterId);
      if (own !== undefined) {
        return own.worldKey === current.world ? current : { ...current, world: own.worldKey };
      }
      if (editId !== null && current.characterId !== '') return current;
      const main = characterList.find((character) => character.isMain) ?? characterList[0];
      return { ...current, characterId: main.id, world: main.worldKey };
    });
  }, [characterList, editId, draft.characterId]);

  // «Editar»: the listing of the account fills the form.
  useEffect(() => {
    if (editing.state !== 'loading' || texts === null) return undefined;
    let alive = true;
    const { id } = editing;
    void (async () => {
      try {
        const client = await getSupabaseBrowserClient();
        const [trade] = await publishModules();
        const read = client === null ? null : await trade.getMyListing(client, id);
        if (!alive) return;
        const anuncio = read?.data ?? null;
        if (read === null || read.error !== null) {
          setEditing({ state: 'error', id, text: texts.publishing.loadFailed });
        } else if (
          anuncio === null ||
          (anuncio.estado !== 'publicado' && anuncio.estado !== 'reservado')
        ) {
          setEditing({ state: 'error', id, text: texts.publishing.notEditable });
        } else {
          setDraft(draftFromListing(anuncio, locale));
          setEditing({ state: 'ready', id });
        }
      } catch {
        if (alive) setEditing({ state: 'error', id, text: texts.publishing.loadFailed });
      }
    })();
    return () => {
      alive = false;
    };
  }, [editing, texts, locale]);

  // «Enlace copiado» goes back to «Copiar enlace» after a moment.
  useEffect(() => {
    if (linkCopy !== 'copied') return undefined;
    const timer = window.setTimeout(() => setLinkCopy('idle'), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [linkCopy]);

  useEffect(() => {
    if (focusNext === null) return;
    setFocusNext(null);
    document.getElementById(focusNext)?.focus();
  }, [focusNext]);

  // The browser did not copy: the link is selected in its field, so one shortcut copies it.
  useEffect(() => {
    if (linkCopy !== 'failed') return;
    const field = document.getElementById(ID.link);
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  }, [linkCopy]);

  const context: Context = { locale, roster: rosterData, addons };
  const reading = readDraft(draft, context);
  const validation = validate(draft, reading, context, labels.errors, {
    worlds: worlds.length,
    character: texts === null ? null : texts.sellAs.required,
    noTotal: labels.unitPrice.noTotal,
  });
  const character = characterList?.find((entry) => entry.id === draft.characterId) ?? null;
  const shown: Record<string, string> = {};
  for (const id of validation.order) {
    const message = validation.errors[id];
    if (message !== undefined && (submitted || touched.has(id))) shown[id] = message;
  }

  useLayoutEffect(() => {
    if (formRef.current !== null) markInvalid(formRef.current, shown);
  });

  // The names the title and the copied text read (9.4).
  const names: ListingNames = {
    pokemon: (id) => rosterData?.byId.get(id)?.nombre,
    item: (id) => itemsData?.byId.get(id)?.nombre,
    addon: (id) => addonNames.get(id),
    aura: (id) => auraNames[id],
    mundo: (id) => worldNames[id],
    vendedor: () => undefined,
    heldTier: (id) => {
      const row = itemsData?.byId.get(id);
      return row === undefined ? undefined : heldTierOf(row);
    },
  };

  // ------------------------------------------------------------------ picker options

  const tipLabels = ui.tooltip;
  const pokemonChoices = useMemo(
    () =>
      rosterData === null
        ? []
        : pokemonOptions(
            rosterPickerRecords(rosterData.rows, (row) =>
              pokemonTip(
                {
                  ...(row as PokedexRow),
                  elementos: row.elementos.map((element) => {
                    const nombre = rosterData.elements[element]?.nombre ?? element;
                    return { nombre: { es: nombre, en: nombre } };
                  }),
                  ...pokemonPanel(panels?.pokemon[row.id], locale, panels?.tipos),
                },
                locale,
                tipLabels,
              ),
            ),
          ),
    [rosterData, locale, tipLabels, panels],
  );
  const itemChoices = useMemo(
    () =>
      itemsData === null
        ? []
        : itemOptions(
            itemPickerRecords(itemsData.rows as readonly ItemsRow[], (row) =>
              itemPanel(
                row as ItemsRow,
                itemsData.refs,
                props.categories[row.categoria] ?? null,
                locale,
                tipLabels,
                itemTip,
                panels?.items[row.id],
              ),
            ),
          ),
    [itemsData, props.categories, locale, tipLabels, panels],
  );
  const ballChoices = useMemo(
    () => itemChoices.filter((option) => option.facets?.categoria?.includes(BALL_CATEGORY)),
    [itemChoices],
  );
  const elementChoices = useMemo(
    () => Object.entries(rosterData?.elements ?? {}).map(([id, ref]) => ({ id, name: ref.nombre })),
    [rosterData],
  );
  // The panel of an aura or an addon (16.4.5): with the panels file, the Balls that unlock the
  // aura and the Pokémon of the addon.
  const gearOf = useCallback(
    (kind: 'aura' | 'addon') => (entity: SlotEntity) =>
      gearTip(
        kind,
        {
          id: entity.id,
          nombre: entity.nombre,
          sprite: entity.icono,
          balls: kind === 'aura' ? panels?.auras[entity.id] : undefined,
          pokemon: kind === 'addon' ? panels?.addons[entity.id] : undefined,
        },
        tipLabels,
      ),
    [panels, tipLabels],
  );
  const auraSlots = useMemo(() => slotRecords(auras, gearOf('aura')), [auras, gearOf]);

  const previewLabels = useMemo<ListingPreviewLabels>(
    () => ({
      card: { ...props.preview.card, shiny: ui.shiny, money: ui.money },
      tooltip: ui.tooltip,
      now: props.preview.now,
      unsellable: props.preview.unsellable,
      unitPrice: labels.unitPrice,
      anyWorld: props.preview.anyWorld,
    }),
    [props.preview, ui, labels.unitPrice],
  );

  const previewData = useMemo<ListingPreviewData>(
    () => ({
      pokemon: rosterData?.byId ?? new Map(),
      elements: rosterData?.elements ?? {},
      items: itemsData?.byId ?? new Map(),
      itemRefs: itemsData?.refs ?? { elementos: {}, pokemon: {} },
      categories: props.categories,
      auras: auraEntities,
      addons: addonEntities,
      worlds: worldNames,
      sprites,
      diamonds: props.diamonds,
      panels,
    }),
    [
      panels,
      rosterData,
      itemsData,
      props.categories,
      auraEntities,
      addonEntities,
      worldNames,
      sprites,
      props.diamonds,
    ],
  );

  // ------------------------------------------------------------------------- changes

  /** A change of the reader: the draft, stored from then on (9.7.7). */
  function update(change: (current: Draft) => Draft) {
    edited.current = true;
    setDraft(change);
  }

  function setUnit(change: (unit: PokemonDraft) => PokemonDraft) {
    update((current) => ({ ...current, pokemon: change(current.pokemon) }));
  }

  function setPrice(change: (price: PriceDraft) => PriceDraft) {
    update((current) => ({ ...current, price: change(current.price) }));
  }

  /** A number or a choice validates from its first change (9.7.5). */
  function touch(id: string) {
    setTouched((current) => (current.has(id) ? current : new Set(current).add(id)));
  }

  /** A text field validates once it changed and the reader leaves it (9.7.5). */
  function typed(id: string) {
    changed.current.add(id);
  }

  function left(id: string) {
    if (changed.current.delete(id)) touch(id);
  }

  function chooseType(tipo: TipoActivo) {
    update((current) => {
      const [first, ...rest] = current.price.game;
      // An empty option in the currency of the new asset takes the other one (9.7.4, rule 3).
      const game =
        first.amount.trim() === '' && first.kind === tipo
          ? [{ ...first, kind: other(first.kind) }, ...rest]
          : current.price.game;
      return { ...current, tipo, price: { ...current.price, game } };
    });
  }

  function choosePokemon(pokemon: string | null) {
    touch(ID.pokemon);
    setUnit((unit) => {
      const own = pokemon === null ? [] : (addons[pokemon] ?? []);
      return {
        ...unit,
        pokemon,
        // 9.7.2: one Memory Slot by default when the Pokémon becomes a Ditto.
        memorySlots:
          isDittoSlug(pokemon) && unit.memorySlots === null
            ? LIMITS.memorySlots[0]
            : unit.memorySlots,
        addons: unit.addons.filter((addon) => own.some((entry) => entry.id === addon)),
      };
    });
  }

  function addOption() {
    setPrice((price) => ({
      ...price,
      game: [...price.game, { kind: other(price.game[0].kind), amount: '' }],
    }));
    setFocusNext(ID.gameAmount(1));
  }

  function removeOption(index: number) {
    const rest = draft.price.game.filter((_, position) => position !== index);
    if (rest.length > 0) {
      setPrice((price) => ({ ...price, game: rest }));
      // The one option left is the only way to «Añadir otra opción», which then shows.
      setFocusNext(rest[0].amount.trim() === '' ? ID.gameAmount(0) : ID.addOption);
    } else {
      setPrice((price) => ({ ...price, game: [emptyRow(draft.tipo)] }));
      setFocusNext(ID.gameAmount(0));
    }
    // The rows moved: what the reader did in the removed one says nothing about the other.
    setTouched((current) => new Set([...current].filter((id) => !GAME_FIELD.test(id))));
  }

  function setNegotiable(negotiable: boolean) {
    // 9.7.4: «A convenir» empties and disables both parts of the price.
    setPrice((price) =>
      negotiable
        ? { ...price, negotiable, real: '', game: [emptyRow(draft.tipo)] }
        : { ...price, negotiable },
    );
  }

  /** Validates the draft; with errors, shows them and focuses the first (9.7.5). */
  function valid(): boolean {
    const first = validation.order.find((id) => validation.errors[id] !== undefined);
    if (first === undefined) {
      setSubmitted(true);
      return true;
    }
    // The errors are committed first, so the field already says it is invalid, and why, when a
    // screen reader announces it on focus.
    flushSync(() => setSubmitted(true));
    document.getElementById(first)?.focus();
    return false;
  }

  /** The line of a publish or a save the database refused, or that did not reach it. */
  function failureOf(
    words: ListingFormPublishing,
    error: { code?: string | null; network?: boolean } | null,
    reason: string | null,
    mapSupabaseError: (error: unknown, locale: Locale) => string,
  ): Failure {
    const known = refusalFor(reason, words.refusals, formatInteger(ANUNCIOS_ACTIVOS_MAX, locale));
    if (known !== null) return { ...known, retry: false };
    const again = retryable(error);
    return {
      text:
        error?.network === true || error === null
          ? words.refusals.network
          : mapSupabaseError(error, locale),
      toListings: false,
      toAccount: false,
      retry: again,
    };
  }

  /**
   * «Publicar anuncio» (9.7.8, 16.4.4) or, editing, «Guardar cambios»: session, requirements,
   * consent, then the RPC. While it runs the button reads «Publicando…» and the form is locked.
   */
  async function publish(consented = false): Promise<void> {
    if (texts === null || publishing || !valid()) return;
    setPublishing(true);
    setBlocker(null);
    setFailure(null);
    let mapSupabaseError: (error: unknown, locale: Locale) => string = () =>
      texts.publishing.refusals.network;
    try {
      const [trade, errors, consent] = await publishModules();
      mapSupabaseError = errors.mapSupabaseError;
      const { getMyAccount, publishListing, updateListing } = trade;
      const { contactBlocker } = consent;
      const client = await getSupabaseBrowserClient();
      if (client === null) {
        setFailure(failureOf(texts.publishing, null, null, mapSupabaseError));
        return;
      }
      const { data } = await client.auth.getSession();
      const account = data.session === null ? null : await getMyAccount(client);
      if (account === null || account.data === null) {
        setBlocker({
          text: texts.signInLine,
          link: { href: `/${locale}/cuenta/`, label: texts.signIn },
        });
        return;
      }
      if (account.error !== null) {
        setFailure(failureOf(texts.publishing, account.error, account.reason, mapSupabaseError));
        return;
      }
      const missing = contactBlocker(account.data, locale, texts.contact);
      if (missing !== null) {
        setBlocker(missing);
        return;
      }
      if (reading.anuncio.precio.real !== null && !account.data.consentCurrent && !consented) {
        setConsentError(null);
        setConsentOpen(true);
        return;
      }
      const input = { ...reading.anuncio, characterId: draft.characterId || null };
      if (editId !== null) {
        const saved = await updateListing(client, editId, input);
        if (saved.error !== null) {
          setFailure(failureOf(texts.publishing, saved.error, saved.reason, mapSupabaseError));
          return;
        }
        // Saved: the listing page shows it (its owner view has «Editar anuncio» again).
        window.location.assign(`/${locale}/comercio/anuncio/${editId}/`);
        return;
      }
      const result = await publishListing(client, input);
      if (result.error !== null || result.data === null) {
        setFailure(failureOf(texts.publishing, result.error, result.reason, mapSupabaseError));
        return;
      }
      setPublished({
        id: result.data,
        until: listingExpiry(Date.now()),
        draft: reading.anuncio,
        character: character?.playerName ?? null,
      });
      setLinkCopy('idle');
      // Published: the draft is gone, the form starts empty as the same character.
      edited.current = false;
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Without storage there is no draft to remove.
      }
      setDraft((current) => ({
        ...emptyDraft(),
        characterId: current.characterId,
        world: current.world,
      }));
      setSubmitted(false);
      setTouched(new Set());
    } catch {
      // A call that threw never reached the database (the network, a chunk that did not load).
      setFailure(failureOf(texts.publishing, null, null, mapSupabaseError));
    } finally {
      setPublishing(false);
    }
  }

  async function acceptConsent(): Promise<void> {
    setConsentError(null);
    let mapSupabaseError: (error: unknown, locale: Locale) => string = () => '';
    try {
      const [{ acceptRealMoneyConsent }, errors] = await publishModules();
      mapSupabaseError = errors.mapSupabaseError;
      const client = await getSupabaseBrowserClient();
      const result = client === null ? null : await acceptRealMoneyConsent(client);
      if (result === null || result.error !== null) {
        setConsentError(mapSupabaseError(result?.error ?? null, locale));
        return;
      }
      setConsentOpen(false);
      await publish(true);
    } catch (caught) {
      setConsentError(mapSupabaseError(caught, locale));
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (texts !== null) void publish();
    else valid();
  }

  /** The address of the published listing, absolute: what «Copiar enlace» copies. */
  const publishedUrl =
    published === null || typeof window === 'undefined'
      ? ''
      : new URL(`/${locale}/comercio/anuncio/${published.id}/`, window.location.origin).href;

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(publishedUrl);
      setLinkCopy('copied');
    } catch {
      setLinkCopy('failed');
    }
  }

  /** «Crear otro anuncio»: the dialog closes and the focus goes to «¿Qué vendes?». */
  function another(): void {
    setPublished(null);
    setFocusNext(ID.type);
  }

  // -------------------------------------------------------------------------- fields

  /** The attributes of an input: its error, and the leaving that ends its first interaction. */
  const invalid = (id: string) => ({
    onBlur: () => left(id),
    'aria-invalid': shown[id] === undefined ? undefined : (true as const),
    'aria-describedby': shown[id] === undefined || shown[id] === '' ? undefined : errorId(id),
  });

  const textField = (
    id: string,
    label: string,
    value: string,
    onText: (next: string) => void,
    options: {
      max?: number;
      helper?: ReactNode;
      labelHidden?: boolean;
      disabled?: boolean;
      inputMode?: 'decimal' | 'numeric';
    } = {},
  ) => (
    <TextField
      id={id}
      label={label}
      labelHidden={options.labelHidden}
      value={value}
      helper={options.helper}
      disabled={options.disabled}
      inputMode={options.inputMode}
      inputProps={{ ...invalid(id), maxLength: options.max ?? AMOUNT_MAX, autoComplete: 'off' }}
      onChange={(next) => {
        typed(id);
        onText(next);
      }}
    />
  );

  const stepper = (
    id: string,
    label: string,
    value: number | null,
    [min, max]: readonly [number, number],
    onNumber: (next: number | null) => void,
    slider = false,
  ) => (
    <Stepper
      name={id}
      label={label}
      value={value ?? min}
      min={min}
      max={max}
      slider={slider}
      decrementLabel={fill(ui.decrease, { label })}
      incrementLabel={fill(ui.increase, { label })}
      onChange={(next) => {
        touch(id);
        onNumber(next);
      }}
    />
  );

  /** The exact figure of a typed Pokédólares amount, its sprite first (9.7.3, S8). */
  const exactFigure = (value: string): ReactNode => {
    const parsed = parsePokedolares(value, locale);
    if (!parsed.ok) return undefined;
    return (
      <span className="ac-listing-form__exact">
        {sprites.pokedolares === null ? null : (
          <span className="ac-pokedolares-amount__sprite" aria-hidden="true">
            <Sprite {...sprites.pokedolares} className="ac-pokedolares-amount__img" />
          </span>
        )}
        {formatPokedolaresLabel(parsed.valor, locale)}
      </span>
    );
  };

  // ------------------------------------------------------------------------ Pokémon

  const unit = draft.pokemon;
  const slots = reading.ditto ? (within(unit.memorySlots, LIMITS.memorySlots) ?? 0) : 0;

  const setTraining = (index: number, change: Partial<TrainingRow>) =>
    setUnit((current) => ({
      ...current,
      training: current.training.map((row, position) =>
        position === index ? { ...row, ...change } : row,
      ),
    }));

  const setMemory = (index: number, memory: string | null) =>
    setUnit((current) => ({
      ...current,
      memories: current.memories.map((entry, position) => (position === index ? memory : entry)),
    }));

  const pickerBase = {
    locale,
    labels: pickers.picker,
    hint: ui.pinHint,
    shinyLabel: ui.shiny,
    orLabel: ui.or,
  };
  const one = (id: string | null) => (id === null ? [] : [id]);
  const pokemonPicker = (
    id: string,
    label: string,
    value: string | null,
    onPick: (next: string | null) => void,
  ) => (
    <PokemonPicker
      {...pickerBase}
      name={id}
      label={label}
      placeholder={pickers.choosePokemon}
      options={pokemonChoices}
      value={one(value)}
      labelHidden={id === ID.pokemon}
      optional={id !== ID.pokemon}
      disabled={rosterData === null}
      elements={elementChoices}
      filterLabels={pickers.filters}
      onChange={(ids) => onPick(ids[0] ?? null)}
    />
  );
  const ownAddons = unit.pokemon === null ? [] : (addons[unit.pokemon] ?? []);

  const npcOptions: ToggleGroupOption[] = [
    { value: 'none', label: labels.npcNone },
    { value: 'unsellable', label: labels.npcUnsellable },
    { value: 'amount', label: labels.amount },
  ];

  const hints = labels.hints ?? {};

  const pokemonFields = (
    <>
      <Row label={labels.pokemon}>
        <Field id={ID.pokemon} error={shown[ID.pokemon]} slot>
          {pokemonPicker(ID.pokemon, labels.pokemon, unit.pokemon, choosePokemon)}
          {roster.state === 'error' ? (
            <p className="ac-listing-form__line">{ui.dataError}</p>
          ) : null}
        </Field>
      </Row>
      <Row label={labels.ball} hint={hints.optional}>
        <Field id={ID.ball} slot>
          <ItemPicker
            {...pickerBase}
            name={ID.ball}
            label={labels.ball}
            labelHidden
            placeholder={pickers.chooseBall}
            options={ballChoices}
            value={one(unit.ball)}
            optional
            disabled={itemsData === null}
            categoryLabel={pickers.category}
            categoryNames={props.categories}
            onChange={(ids) => setUnit((current) => ({ ...current, ball: ids[0] ?? null }))}
          />
        </Field>
      </Row>
      {auraSlots.length > 0 ? (
        <Row label={pickers.auras} hint={hints.auras}>
          <AuraPicker
            locale={locale}
            name="lf-auras"
            label={pickers.auras}
            labelHidden
            noneLabel={labels.auraNone}
            options={auraSlots}
            value={unit.auras}
            onChange={(ids) => setUnit((current) => ({ ...current, auras: ids }))}
          />
        </Row>
      ) : null}
      {unit.pokemon !== null && ownAddons.length > 0 ? (
        <Row label={pickers.addons} hint={hints.addons}>
          <AddonPicker
            locale={locale}
            name="lf-addons"
            label={pickers.addons}
            labelHidden
            noneLabel={labels.addonNone}
            pokemonId={unit.pokemon}
            options={slotRecords(
              ownAddons.map((addon) => ({ ...addon, icono: addon.icono ?? null })),
              gearOf('addon'),
            )}
            value={unit.addons}
            onChange={(ids) => setUnit((current) => ({ ...current, addons: ids }))}
          />
        </Row>
      ) : null}
      {/* Held X, Held Y and Mega Stone: three slot triggers of one width, each named on its
          second line. */}
      <Row label={labels.heldItems} hint={hints.held} group>
        <div className="ac-listing-form__held">
          {(['x', 'y'] as const).map((ranura) => {
            const key = ranura === 'x' ? 'heldX' : 'heldY';
            const name = ranura === 'x' ? pickers.heldX : pickers.heldY;
            return (
              <Field key={ranura} id={`lf-held-${ranura}`}>
                <HeldPicker
                  {...pickerBase}
                  name={`lf-held-${ranura}`}
                  label={name}
                  labelHidden
                  meta={name}
                  placeholder={pickers.chooseHeld}
                  options={itemChoices}
                  ranura={ranura}
                  tierLabel={labels.tier}
                  value={one(unit[key])}
                  optional
                  disabled={itemsData === null}
                  onChange={(ids) => setUnit((current) => ({ ...current, [key]: ids[0] ?? null }))}
                />
              </Field>
            );
          })}
          <MegaPicker
            {...pickerBase}
            name="lf-mega"
            label={pickers.mega}
            labelHidden
            meta={pickers.mega}
            placeholder={pickers.chooseMega}
            options={itemChoices}
            pokemonId={unit.pokemon}
            value={one(unit.mega)}
            optional
            onChange={(ids) => setUnit((current) => ({ ...current, mega: ids[0] ?? null }))}
          />
        </div>
      </Row>
      {/* Boost, then Star Level on the same row with its own inline label. */}
      <Row label={labels.boost} hint={labels.boostHelp}>
        <div className="ac-listing-form__inline">
          <Field id={ID.boost} error={shown[ID.boost]}>
            {stepper(
              ID.boost,
              labels.boost,
              unit.boost,
              LIMITS.boost,
              (boost) => setUnit((current) => ({ ...current, boost })),
              true,
            )}
          </Field>
          <Field id={ID.starLevel} error={shown[ID.starLevel]}>
            <StarLevel
              name={ID.starLevel}
              label={labels.starLevel}
              value={unit.starLevel ?? 0}
              max={LIMITS.starLevel[1]}
              starLabel={pickers.star}
              onChange={(starLevel) =>
                setUnit((current) => ({
                  ...current,
                  starLevel: starLevel === 0 ? null : starLevel,
                }))
              }
            />
          </Field>
        </div>
      </Row>
      <Row label={labels.nickname}>
        <Field id={ID.nickname} error={shown[ID.nickname]} slot>
          {textField(
            ID.nickname,
            labels.nickname,
            unit.nickname,
            (nickname) => setUnit((current) => ({ ...current, nickname })),
            { max: NOMBRE_MAX, labelHidden: true },
          )}
        </Field>
      </Row>
      <Row label={labels.nextBoostChance}>
        <Field id={ID.nextBoostChance} error={shown[ID.nextBoostChance]} narrow>
          {textField(
            ID.nextBoostChance,
            labels.nextBoostChance,
            unit.nextBoostChance,
            (nextBoostChance) => setUnit((current) => ({ ...current, nextBoostChance })),
            { inputMode: 'decimal', labelHidden: true },
          )}
        </Field>
      </Row>
      {reading.ditto ? (
        <Row label={labels.memorySlots}>
          <Field id={ID.memorySlots} error={shown[ID.memorySlots]}>
            {stepper(
              ID.memorySlots,
              labels.memorySlots,
              unit.memorySlots,
              LIMITS.memorySlots,
              (memorySlots) => setUnit((current) => ({ ...current, memorySlots })),
            )}
          </Field>
        </Row>
      ) : null}
      {unit.memories.slice(0, slots).map((memory, index) => {
        const name = fill(labels.memory, { n: formatInteger(index + 1, locale) });
        return (
          // The Memory Slots are a fixed sequence of the Ditto: the position is the identity.
          <Row key={index} label={name}>
            <Field id={ID.memory(index)} error={shown[ID.memory(index)]} slot>
              {pokemonPicker(ID.memory(index), name, memory, (next) => setMemory(index, next))}
            </Field>
          </Row>
        );
      })}
    </>
  );

  // The training tray: the eight skills, each a level, a progress and its meter.
  const trainingFields = (
    <section className="ac-listing-form__tray" aria-label={labels.training}>
      <Row label={labels.training} hint={hints.training} top>
        <table className="ac-listing-form__train-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">{labels.training}</span>
              </th>
              <th scope="col">{labels.level}</th>
              <th scope="col">{labels.progress}</th>
              <th scope="col">
                <span className="sr-only">{labels.training}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {HABILIDADES.map((skill, index) => {
              const row = unit.training[index];
              const level = within(row.level, LIMITS.level);
              const progress = percent(row.progress);
              return (
                <tr key={skill}>
                  <th scope="row">{skill}</th>
                  <td>
                    {stepper(
                      ID.trainLevel(index),
                      `${skill} · ${labels.level}`,
                      row.level,
                      LIMITS.level,
                      (next) => setTraining(index, { level: next }),
                    )}
                  </td>
                  <td>
                    <Field id={ID.trainProgress(index)} error={shown[ID.trainProgress(index)]}>
                      {textField(
                        ID.trainProgress(index),
                        `${skill} · ${labels.progress}`,
                        row.progress,
                        (next) => setTraining(index, { progress: next }),
                        { inputMode: 'decimal', labelHidden: true },
                      )}
                    </Field>
                  </td>
                  <td>
                    {level !== null && progress !== null ? (
                      <TrainingMeter
                        variant="card"
                        stat={skill}
                        level={level}
                        percent={Number(progress)}
                        locale={locale}
                        labels={ui.money}
                      />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Row>
    </section>
  );

  // NPC Price opens the price tray of a Pokémon: the three choices, then the amount.
  const npcRow =
    draft.tipo === 'pokemon' ? (
      <Row label={labels.npcPrice}>
        <div className="ac-listing-form__inline">
          <ToggleGroup
            id="lf-npc"
            className="ac-listing-form__segmented"
            label={labels.npcPrice}
            options={npcOptions}
            value={unit.npc}
            onChange={(npc) =>
              setUnit((current) => ({ ...current, npc: looseOneOf(npc, NPC_CHOICES, 'none') }))
            }
          />
          {unit.npc === 'amount' ? (
            <Field id={ID.npcAmount} error={shown[ID.npcAmount]} narrow>
              {textField(
                ID.npcAmount,
                labels.amount,
                unit.npcAmount,
                (npcAmount) => setUnit((current) => ({ ...current, npcAmount })),
                { labelHidden: true },
              )}
            </Field>
          ) : null}
        </div>
      </Row>
    ) : null;

  // ------------------------------------------------------------- items and currencies

  const assetFields =
    draft.tipo === 'pokemon' ? (
      pokemonFields
    ) : draft.tipo === 'items' ? (
      <>
        <Row label={labels.item}>
          <Field id={ID.item} error={shown[ID.item]} slot>
            <ItemPicker
              {...pickerBase}
              name={ID.item}
              label={labels.item}
              labelHidden
              placeholder={pickers.chooseItem}
              options={itemChoices}
              value={one(draft.item.id)}
              disabled={itemsData === null}
              categoryLabel={pickers.category}
              categoryNames={props.categories}
              onChange={(ids) => {
                touch(ID.item);
                update((current) => ({
                  ...current,
                  item: { ...current.item, id: ids[0] ?? null },
                }));
              }}
            />
          </Field>
        </Row>
        <Row label={labels.quantity}>
          <Field id={ID.itemQuantity} error={shown[ID.itemQuantity]} narrow>
            {textField(
              ID.itemQuantity,
              labels.quantity,
              draft.item.quantity,
              (quantity) =>
                update((current) => ({ ...current, item: { ...current.item, quantity } })),
              { labelHidden: true },
            )}
          </Field>
        </Row>
      </>
    ) : draft.tipo === 'diamonds' ? (
      <Row label={labels.quantity}>
        <Field id={ID.diamonds} error={shown[ID.diamonds]} narrow>
          {textField(
            ID.diamonds,
            labels.quantity,
            draft.diamonds,
            (diamonds) => update((current) => ({ ...current, diamonds })),
            { labelHidden: true },
          )}
        </Field>
      </Row>
    ) : (
      <Row label={labels.quantity}>
        <Field id={ID.pokedolares} error={shown[ID.pokedolares]} slot>
          {textField(
            ID.pokedolares,
            labels.quantity,
            draft.pokedolares,
            (pokedolares) => update((current) => ({ ...current, pokedolares })),
            { helper: exactFigure(draft.pokedolares), labelHidden: true },
          )}
        </Field>
      </Row>
    );

  // --------------------------------------------------------------------------- price

  const { price } = draft;
  const optionsTyped = price.game.filter((row) => row.amount.trim() !== '').length;
  const currencyOptions: SelectOption[] = MONEDAS_REALES.map((currency) => ({
    value: currency,
    label: SIMBOLOS_MONEDA[currency],
  }));
  const kindOptions: SelectOption[] = MONEDAS_JUEGO.map((kind) => ({
    value: kind,
    label: ui.tooltip[kind],
  }));

  const setRow = (index: number, change: Partial<GameRow>) =>
    setPrice((current) => ({
      ...current,
      game: current.game.map((row, position) => (position === index ? { ...row, ...change } : row)),
    }));

  // A price per unit (owner rule 2026-09-24): Items, Diamonds and Pokédólares. The two price rows
  // then hold the price of one unit, the unit is its own field, and the total shows under them.
  const unitMode = perUnit(draft);
  const unitHint = unitMode ? labels.unitPrice.perUnit : undefined;
  const totals = reading.anuncio.precio;
  const totalParts = [
    totals.real === null
      ? null
      : formatRealMoney(Number(totals.real.importe), totals.real.moneda, locale),
    ...totals.juego.map((option) =>
      option.tipo === 'pokedolares'
        ? formatPokedolares(option.cantidad, locale)
        : formatDiamonds(option.cantidad, locale),
    ),
  ].filter((part): part is string => part !== null);
  const modeOptions: ToggleGroupOption[] = [
    { value: 'total', label: labels.unitPrice.total },
    { value: 'unit', label: labels.unitPrice.perUnit },
  ];

  const priceFields = (
    <>
      {npcRow}
      {hasUnitPrice(draft.tipo) ? (
        <Row label={labels.unitPrice.mode}>
          <ToggleGroup
            id={ID.priceMode}
            className="ac-listing-form__segmented"
            label={labels.unitPrice.mode}
            options={modeOptions.map((option) => ({ ...option, disabled: price.negotiable }))}
            value={price.negotiable ? 'total' : price.mode}
            onChange={(mode) =>
              setPrice((current) => ({ ...current, mode: looseOneOf(mode, PRICE_MODES, 'total') }))
            }
          />
        </Row>
      ) : null}
      {unitMode ? (
        <Row label={labels.unitPrice.unit} hint={labels.unitPrice.unitHelp}>
          <Field id={ID.unit} error={shown[ID.unit]} narrow>
            {textField(
              ID.unit,
              labels.unitPrice.unit,
              price.unit,
              (unit) => setPrice((current) => ({ ...current, unit })),
              { labelHidden: true },
            )}
          </Field>
        </Row>
      ) : null}
      <Row label={labels.fiat} hint={unitHint} group>
        <div className="ac-listing-form__pair ac-listing-form__pair--money">
          <Field id={ID.currency}>
            <Select
              id={ID.currency}
              label={labels.currency}
              labelHidden
              options={currencyOptions}
              value={price.currency}
              disabled={price.negotiable}
              onChange={(currency) =>
                setPrice((current) => ({
                  ...current,
                  currency: looseOneOf(currency, MONEDAS_REALES, current.currency),
                }))
              }
            />
          </Field>
          <Field id={ID.real} error={shown[ID.real]}>
            {textField(
              ID.real,
              labels.amount,
              price.real,
              (real) => setPrice((current) => ({ ...current, real })),
              {
                labelHidden: true,
                disabled: price.negotiable,
                inputMode: 'decimal',
              },
            )}
          </Field>
        </div>
      </Row>
      <Row label={labels.game} hint={unitHint} group top>
        <div className="ac-listing-form__options">
          {price.game.map((row, index) => (
            // The options are the seller's sequence: the position is the identity.
            <div key={index} className="ac-listing-form__option">
              <Field id={ID.gameKind(index)} error={shown[ID.gameKind(index)]}>
                <Select
                  id={ID.gameKind(index)}
                  label={labels.currency}
                  labelHidden
                  options={kindOptions}
                  value={row.kind}
                  disabled={price.negotiable}
                  onChange={(kind) => {
                    touch(ID.gameKind(index));
                    setRow(index, { kind: looseOneOf(kind, MONEDAS_JUEGO, row.kind) });
                  }}
                />
              </Field>
              <Field id={ID.gameAmount(index)} error={shown[ID.gameAmount(index)]}>
                {textField(
                  ID.gameAmount(index),
                  labels.amount,
                  row.amount,
                  (amount) => setRow(index, { amount }),
                  {
                    labelHidden: true,
                    disabled: price.negotiable,
                  },
                )}
              </Field>
              {/* An option exists once it has an amount, and only then can it be removed; with two,
                either can. */}
              {!price.negotiable && (price.game.length > 1 || row.amount.trim() !== '') ? (
                <Button onClick={() => removeOption(index)}>{labels.removeOption}</Button>
              ) : null}
            </div>
          ))}
          {/* 9.7.4: «Añadir otra opción» only while there is one option. */}
          {!price.negotiable && price.game.length === 1 && optionsTyped === 1 ? (
            <div>
              <Button id={ID.addOption} onClick={addOption}>
                {labels.addOption}
              </Button>
            </div>
          ) : null}
        </div>
      </Row>
      {unitMode && totalParts.length > 0 ? (
        <Row label="">
          <p className="ac-listing-form__total">
            {fill(labels.unitPrice.totalLine, { price: totalParts.join(` ${ui.or} `) })}
          </p>
        </Row>
      ) : null}
      <Row label="">
        <Checkbox
          id={ID.negotiable}
          label={labels.negotiable}
          checked={price.negotiable}
          onChange={(checked) => setNegotiable(checked)}
        />
      </Row>
    </>
  );

  // ------------------------------------------------------------------ «Vendes como»

  const worldName = (id: string) => worldNames[id] ?? id;
  const sellAs = texts?.sellAs ?? null;
  let sellAsRow: ReactNode = null;
  let worldRow: ReactNode = null;
  if (texts !== null && sellAs !== null) {
    let control: ReactNode;
    if (characters.state === 'signed-out') {
      control = (
        <p className="ac-listing-form__line">
          {texts.signInLine} <TextLink href={`/${locale}/cuenta/`}>{texts.signIn}</TextLink>
        </p>
      );
    } else if (characters.state === 'error') {
      control = <p className="ac-listing-form__line">{ui.dataError}</p>;
    } else if (characters.state === 'ready' && characters.list.length === 0) {
      control = (
        <div className="ac-listing-form__empty">
          <p className="ac-listing-form__line">{sellAs.empty}</p>
          <Button href={texts.charactersHref}>{sellAs.add}</Button>
        </div>
      );
    } else {
      const list = characterList ?? [];
      control = (
        <div className="ac-listing-form__sell-as">
          <Field id={ID.character} error={shown[ID.character]} slot>
            <Select
              id={ID.character}
              label={sellAs.label}
              labelHidden
              placeholder={sellAs.choose}
              options={list.map((entry) => ({
                value: entry.id,
                label: [
                  entry.playerName,
                  worldName(entry.worldKey),
                  entry.isMain ? sellAs.main : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
              value={draft.characterId || undefined}
              disabled={characters.state === 'loading'}
              onChange={(id) => {
                const chosen = list.find((entry) => entry.id === id);
                if (chosen === undefined) return;
                touch(ID.character);
                update((current) => ({
                  ...current,
                  characterId: chosen.id,
                  world: chosen.worldKey,
                }));
              }}
            />
          </Field>
          <TextLink href={texts.charactersHref}>{sellAs.characters}</TextLink>
        </div>
      );
    }
    sellAsRow = <Row label={sellAs.label}>{control}</Row>;
    // The world is the character's: shown, never chosen (board Personajes, Variante 1 and 2).
    worldRow = (
      <Row label={labels.world}>
        <div className="ac-listing-form__world">
          <span className="ac-listing-form__world-name">
            {character === null ? UNKNOWN : worldName(character.worldKey)}
          </span>
          <span className="ac-listing-form__row-hint">
            {tradesAcrossWorlds(draft.tipo) ? sellAs.anyWorld : sellAs.worldLocked}
          </span>
        </div>
      </Row>
    );
  }

  // ------------------------------------------------------------------------- preview

  // 9.7.6: once the draft has a title and the file its card reads has arrived. Never on the
  // server, where the draft is always the empty one.
  const title = listingTitle(reading.anuncio, locale, names);
  const ready =
    draft.tipo === 'pokemon'
      ? rosterData !== null
      : draft.tipo === 'items'
        ? items.state !== 'loading'
        : true;

  // Plan «Crear anuncio»: ¿Qué vendes?, NPC Price and Mundo are one segmented box each. Editing,
  // the type is locked (the database keeps it).
  const typeOptions: ToggleGroupOption[] = TIPOS_ACTIVO.map((tipo) => ({
    value: tipo,
    label: labels.types[tipo],
    disabled: editId !== null && tipo !== draft.tipo,
  }));

  if (texts !== null && editing.state === 'error') {
    return (
      <div className="ac-listing-form">
        <p className="ac-listing-form__line" role="status">
          {editing.text}
        </p>
      </div>
    );
  }
  const loadingEdit = editing.state === 'loading';
  const words = texts?.publishing ?? null;

  return (
    <div className="ac-listing-form">
      <form
        ref={formRef}
        className="ac-listing-form__form"
        noValidate
        onSubmit={submit}
        aria-busy={publishing || loadingEdit}
      >
        <fieldset className="ac-listing-form__lock" disabled={publishing || loadingEdit}>
          <section className="ac-listing-form__tray" aria-label={pickers.assetQuestion}>
            {sellAsRow}
            <Row label={pickers.assetQuestion}>
              <ToggleGroup
                id={ID.type}
                className="ac-listing-form__segmented ac-listing-form__segmented--fill"
                label={pickers.assetQuestion}
                options={typeOptions}
                value={draft.tipo}
                onChange={(tipo) => chooseType(looseOneOf(tipo, TIPOS_ACTIVO, draft.tipo))}
              />
            </Row>
            {worldRow}
            {assetFields}
          </section>
          {draft.tipo === 'pokemon' ? trainingFields : null}
          <section className="ac-listing-form__tray" aria-label={labels.price}>
            {priceFields}
            {texts === null && worlds.length > 1 ? (
              <Row label={labels.world}>
                <Field id={ID.world} error={shown[ID.world]}>
                  <ToggleGroup
                    id={ID.world}
                    className="ac-listing-form__segmented"
                    label={labels.world}
                    options={worlds.map((world) => ({ value: world.id, label: world.nombre }))}
                    value={draft.world}
                    onChange={(world) => {
                      touch(ID.world);
                      update((current) => ({ ...current, world }));
                    }}
                  />
                </Field>
              </Row>
            ) : null}
          </section>
        </fieldset>
        {texts !== null && words !== null ? (
          <div className="ac-listing-form__action">
            {failure !== null ? (
              <p className="ac-listing-form__failure" role="alert">
                <strong>{editId === null ? words.failed : words.saveFailed}</strong> {failure.text}
                {failure.toListings ? (
                  <>
                    {' '}
                    <TextLink href={texts.listingsHref}>{words.mine}</TextLink>.
                  </>
                ) : null}
                {failure.toAccount ? (
                  <>
                    {' '}
                    <TextLink href={`/${locale}/cuenta/`}>{texts.contact.goToAccount}</TextLink>
                  </>
                ) : null}
                {failure.retry ? <> {words.kept}</> : null}
              </p>
            ) : null}
            <div className="ac-listing-form__buttons">
              <Button
                id={ID.publish}
                type="submit"
                variant="solid"
                disabled={publishing || loadingEdit}
              >
                {publishing
                  ? editId === null
                    ? words.busy
                    : words.saving
                  : failure?.retry === true
                    ? words.retry
                    : editId === null
                      ? texts.publish
                      : words.save}
              </Button>
            </div>
            {blocker !== null ? (
              <p className="ac-listing-form__line" role="status">
                {blocker.text}
                {blocker.link === null ? null : (
                  <>
                    {' '}
                    <TextLink href={blocker.link.href}>{blocker.link.label}</TextLink>
                  </>
                )}
              </p>
            ) : null}
            {texts !== null && consentOpen ? (
              <Suspense fallback={null}>
                <RealMoneyConsent
                  open={consentOpen}
                  onAccept={() => void acceptConsent()}
                  onClose={() => setConsentOpen(false)}
                  labels={texts.consent}
                  ui={{ close: texts.close, dismiss: ui.dismiss }}
                  busy={publishing}
                  error={consentError}
                  onErrorClose={() => setConsentError(null)}
                />
              </Suspense>
            ) : null}
          </div>
        ) : null}
      </form>
      {/* A named region, not an `aside`: a complementary landmark belongs at the top level of
          the page, and this one lives inside `main` (13.7, WA2). */}
      {title.texto !== UNKNOWN && ready ? (
        <section className="ac-listing-form__preview" aria-label={labels.preview}>
          <Suspense fallback={null}>
            <ListingPreview
              draft={reading.anuncio}
              data={previewData}
              labels={previewLabels}
              locale={locale}
              hint={ui.pinHint}
              orLabel={ui.or}
              character={character?.playerName ?? null}
            />
          </Suspense>
        </section>
      ) : null}
      {texts !== null && words !== null && published !== null ? (
        <Dialog
          open
          onClose={() => setPublished(null)}
          title={texts.published}
          closeLabel={texts.close}
          className="ac-published"
          actions={
            <>
              <TextLink href={texts.listingsHref} className="ac-published__mine">
                {words.mine}
              </TextLink>
              <Button onClick={another}>{words.another}</Button>
              <Button
                {...initialFocus}
                variant="solid"
                href={`/${locale}/comercio/anuncio/${published.id}/`}
              >
                {texts.view}
              </Button>
            </>
          }
        >
          <p className="ac-published__until">
            {fill(words.visibleUntil, { date: formatDate(published.until.toISOString(), locale) })}
          </p>
          <div className="ac-published__body">
            <Suspense fallback={null}>
              <ListingPreview
                draft={published.draft}
                data={previewData}
                labels={{ ...previewLabels, now: props.preview.now }}
                locale={locale}
                hint={ui.pinHint}
                orLabel={ui.or}
                character={published.character}
              />
            </Suspense>
            <div className="ac-published__link">
              <label className="ac-published__label" htmlFor={ID.link}>
                {words.link}
              </label>
              <input
                id={ID.link}
                className="ac-published__url"
                type="text"
                readOnly
                value={publishedUrl}
              />
              <Button onClick={() => void copyLink()}>
                {linkCopy === 'copied' ? words.linkCopied : words.copyLink}
              </Button>
              {linkCopy === 'failed' ? (
                <p className="ac-published__line" role="status">
                  {words.copyFailed}
                </p>
              ) : null}
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
