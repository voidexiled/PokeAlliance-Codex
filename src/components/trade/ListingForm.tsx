import '@/styles/components/listing-form.css';

import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';
import { flushSync } from 'react-dom';

import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Checkbox } from '@/components/controls/Checkbox';
import { Combobox, type ComboboxOption } from '@/components/controls/Combobox';
import { NumberField } from '@/components/controls/NumberField';
import { Select, type SelectOption } from '@/components/controls/Select';
import { TextField } from '@/components/controls/TextField';
import { Textarea } from '@/components/controls/Textarea';
import { ToggleGroup, type ToggleGroupOption } from '@/components/controls/ToggleGroup';
import { ShinyMark } from '@/components/game/ShinyMark';
import { Sprite } from '@/components/game/Sprite';
import { Glyph } from '@/components/icons/Glyph';
import {
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
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import { formatInteger, formatPokedolaresLabel, parsePokedolares } from '@/lib/format/numbers';
import { UNKNOWN } from '@/lib/format/unknown';
import { normalize, normalizeQuery } from '@/lib/search/normalize';
import type { SpriteData } from '@/lib/sprites/resolve';
import {
  isDittoSlug,
  isValidOptionalPercent,
  parsePositiveWhole,
  parsePrice,
} from '@/lib/trade/draft';
import { listingText, type ListingTextLabels } from '@/lib/trade/text';
import { listingTitle, type ListingNames } from '@/lib/trade/title';
import {
  BOOST_MAX,
  HABILIDADES,
  HELDS_MAX,
  HELD_TIER_MAX,
  MEMORY_SLOTS_MAX,
  MONEDAS_JUEGO,
  MONEDAS_REALES,
  NIVEL_ENTRENAMIENTO_MAX,
  NOMBRE_ITEM_MAX,
  NOMBRE_MAX,
  SIMBOLOS_MONEDA,
  STAR_LEVEL_MAX,
  TIPOS_ACTIVO,
  type MonedaJuego,
  type MonedaReal,
  type OpcionJuego,
  type Precio,
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

// ListingForm (spec 9.7, template G of 8.0.2; §12.16, §12.20 points 59–69): the island of
// `/{l}/comercio/publicar/`, «Crear anuncio» of phase A. The form of a listing — «Tipo de
// activo», the fields of the asset (9.7.2, 9.7.3), «Precio» (9.7.4) and «Mundo» — and its live
// preview, the real `ListingCard` (ListingPreview.tsx, 9.7.6). Phase A publishes nothing: there
// is no Supabase, no account and no contact, and the action is «Copiar anuncio», which puts the
// text of 9.7.7 (`listingText`) on the clipboard. It hydrates with `client:load` (7.3).
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
const STORAGE_KEY = 'alliance-codex:comercio:borrador:v1';

/** Limits of the fields of 9.7.2: limits of the form, not game data (Q8). */
const LIMITS = {
  boost: [0, BOOST_MAX],
  starLevel: [0, STAR_LEVEL_MAX],
  memorySlots: [1, MEMORY_SLOTS_MAX],
  tier: [1, HELD_TIER_MAX],
  level: [0, NIVEL_ENTRENAMIENTO_MAX],
} as const satisfies Record<string, readonly [number, number]>;

/** At most two in-game price options, of different currencies (9.7.4). */
const GAME_OPTIONS_MAX = 2;

/** Longest typed amount or percentage: the 15 digits of 9.4 with their separators. */
const AMOUNT_MAX = 24;

/** Suggestions of a combobox: the first ones that match (7.2.8). */
const MAX_MATCHES = 20;

/** A Pokédex number, with or without «#» and leading zeros: «6», «#6», «006». */
const NUMBER_QUERY = /^#?\s*0*(\d+)$/;

/** The item categories of the Ball and of the held items (content/items/categorias.json). */
const BALL_CATEGORY = 'poke-balls';
const HELD_CATEGORY = 'helds';

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
  /** «Copiar anuncio». */
  copy: string;
  /** «Anuncio copiado.». */
  copied: string;
  /** «No se pudo copiar. Selecciona el texto de abajo y cópialo.». */
  copyFailed: string;
  /** «Texto del anuncio». */
  copyText: string;
  /** The name of the preview region, «Vista previa». */
  preview: string;
  errors: ListingFormErrors;
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
  /** «Escribe el nombre del item.»: an items listing without its item. */
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
  /** The labels of the copied text (9.7.7). */
  text: ListingTextLabels;
  /** `messages.ui` of the page's locale, the part the island reads (13.2). */
  ui: ListingFormUi;
}

// ------------------------------------------------------------------------------ draft

/** A combobox over a registry: what the reader wrote and the record it names, if any. */
interface Choice {
  text: string;
  id: string | null;
}

type NpcChoice = 'none' | 'unsellable' | 'amount';

const NPC_CHOICES: readonly NpcChoice[] = ['none', 'unsellable', 'amount'];

interface HeldRow {
  name: string;
  tier: number | null;
}

interface TrainingRow {
  level: number | null;
  progress: string;
}

interface PokemonDraft {
  pokemon: Choice;
  nickname: string;
  ball: string;
  /** Aura id, or '' for «Ninguna». */
  aura: string;
  boost: number | null;
  starLevel: number | null;
  memorySlots: number | null;
  /** MEMORY_SLOTS_MAX entries; the first `memorySlots` are shown. */
  memories: Choice[];
  /** HELDS_MAX rows. */
  helds: HeldRow[];
  /** Addon id, or '' for «Ninguno». */
  addon: string;
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

interface PriceDraft {
  negotiable: boolean;
  currency: MonedaReal;
  real: string;
  /** 1 or 2 rows; a row without an amount is no option. */
  game: GameRow[];
}

interface Draft {
  tipo: TipoActivo;
  pokemon: PokemonDraft;
  item: { name: string; quantity: string };
  diamonds: string;
  pokedolares: string;
  price: PriceDraft;
  /** World id, or '' while none is chosen. */
  world: string;
}

const NO_CHOICE: Choice = { text: '', id: null };

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
      pokemon: NO_CHOICE,
      nickname: '',
      ball: '',
      aura: '',
      boost: null,
      starLevel: null,
      memorySlots: null,
      memories: Array.from({ length: MEMORY_SLOTS_MAX }, () => NO_CHOICE),
      helds: Array.from({ length: HELDS_MAX }, () => ({ name: '', tier: null })),
      addon: '',
      nextBoostChance: '',
      training: HABILIDADES.map(() => ({ level: null, progress: '' })),
      npc: 'none',
      npcAmount: '',
    },
    item: { name: '', quantity: '' },
    diamonds: '',
    pokedolares: '',
    price: {
      negotiable: false,
      currency: MONEDAS_REALES[0],
      real: '',
      game: [emptyRow('pokemon')],
    },
    world: '',
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

function looseChoice(value: unknown): Choice {
  if (!isObject(value)) return NO_CHOICE;
  const id = typeof value.id === 'string' && value.id !== '' ? value.id : null;
  return { text: looseText(value.text, NOMBRE_MAX), id };
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
      pokemon: looseChoice(unit.pokemon),
      nickname: looseText(unit.nickname, NOMBRE_MAX),
      ball: looseText(unit.ball, NOMBRE_MAX),
      aura: looseText(unit.aura, NOMBRE_MAX),
      boost: looseWhole(unit.boost),
      starLevel: looseWhole(unit.starLevel),
      memorySlots: looseWhole(unit.memorySlots),
      memories: Array.from({ length: MEMORY_SLOTS_MAX }, (_, index) =>
        looseChoice(Array.isArray(unit.memories) ? unit.memories[index] : undefined),
      ),
      helds: looseList(unit.helds, HELDS_MAX, (entry) => ({
        name: looseText(entry.name, NOMBRE_MAX),
        tier: looseWhole(entry.tier),
      })),
      addon: looseText(unit.addon, NOMBRE_ITEM_MAX),
      nextBoostChance: looseText(unit.nextBoostChance, AMOUNT_MAX),
      training: looseList(unit.training, HABILIDADES.length, (entry) => ({
        level: looseWhole(entry.level),
        progress: looseText(entry.progress, AMOUNT_MAX),
      })),
      npc: looseOneOf(unit.npc, NPC_CHOICES, 'none'),
      npcAmount: looseText(unit.npcAmount, AMOUNT_MAX),
    },
    item: {
      name: looseText(item.name, NOMBRE_ITEM_MAX),
      quantity: looseText(item.quantity, AMOUNT_MAX),
    },
    diamonds: looseText(stored.diamonds, AMOUNT_MAX),
    pokedolares: looseText(stored.pokedolares, AMOUNT_MAX),
    price: {
      negotiable: price.negotiable === true,
      currency: looseOneOf(price.currency, MONEDAS_REALES, base.price.currency),
      real: looseText(price.real, AMOUNT_MAX),
      game: game.length > 0 ? game : [emptyRow(tipo)],
    },
    world: looseText(stored.world, NOMBRE_ITEM_MAX),
  };
}

function readStoredDraft(): Draft | null {
  try {
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

/** Records by id and by their name as the search compares it (NFD, no accents, lowercase). */
interface Catalogue<Row> {
  rows: readonly Row[];
  byId: ReadonlyMap<string, Row>;
  byName: ReadonlyMap<string, Row>;
  /** The compared name of each row, in the order of `rows`. */
  names: readonly string[];
}

interface Roster extends Catalogue<PokedexRow> {
  elements: PokedexElementRefs;
}

interface Items extends Catalogue<ItemsRow> {
  refs: ItemsData['refs'];
}

function catalogue<Row extends { id: string; nombre: string }>(
  rows: readonly Row[],
): Catalogue<Row> {
  const names = rows.map((row) => normalizeQuery(row.nombre));
  const byName = new Map<string, Row>();
  rows.forEach((row, index) => {
    if (!byName.has(names[index])) byName.set(names[index], row);
  });
  return { rows, byId: new Map(rows.map((row) => [row.id, row])), byName, names };
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

/** The record whose name is exactly the text, accents and case aside (9.4), or `null`. */
function named<Row>(data: Catalogue<Row> | null, typed: string): Row | null {
  if (data === null) return null;
  const wanted = normalizeQuery(typed);
  return wanted === '' ? null : (data.byName.get(wanted) ?? null);
}

/** The first MAX_MATCHES records whose name holds the text, in the order of the file. */
function containing<Row>(
  data: Catalogue<Row> | null,
  typed: string,
  keep: (row: Row) => boolean = () => true,
): Row[] {
  if (data === null) return [];
  const wanted = normalizeQuery(typed);
  if (wanted === '') return [];
  const found: Row[] = [];
  data.rows.forEach((row, index) => {
    if (found.length < MAX_MATCHES && data.names[index].includes(wanted) && keep(row)) {
      found.push(row);
    }
  });
  return found;
}

/** The Pokémon a combobox suggests: by name, or by Pokédex number (7.2.8, 11.3). */
function rosterMatches(roster: Roster | null, typed: string): PokedexRow[] {
  const digits = NUMBER_QUERY.exec(normalize(typed).trim())?.[1];
  if (roster === null || digits === undefined) return containing(roster, typed);
  const wanted = Number(digits);
  return roster.rows.filter((row) => row.numero === wanted).slice(0, MAX_MATCHES);
}

// ------------------------------------------------------------------------ the listing

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
  items: Items | null;
  addons: ListingFormProps['addons'];
}

/** The Pokémon a combobox names: the one chosen from the list, or the one its text is. */
function pokemonOf(value: Choice, roster: Roster | null): string | null {
  if (roster === null) return value.id;
  if (value.id !== null && roster.byId.get(value.id)?.nombre === value.text) return value.id;
  return named(roster, value.text)?.id ?? null;
}

/** The id of the item a declared name matches exactly, in a category or in all (9.4, R2). */
function itemOf(items: Items | null, typed: string, category?: string): string | null {
  const row = named(items, typed);
  return row === null || (category !== undefined && row.categoria !== category) ? null : row.id;
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

function readPrice(draft: Draft, locale: Locale): Precio {
  const { price } = draft;
  if (price.negotiable) return { real: null, juego: [], aConvenir: true };
  const real = parsePrice(price.real, price.currency, locale);
  return {
    real:
      real === null
        ? null
        : { moneda: price.currency, importe: price.real.trim().replace(',', '.') },
    juego: gameOptions(draft, locale),
    aConvenir: false,
  };
}

function readUnit(
  unit: PokemonDraft,
  context: Context,
): Omit<Reading, 'anuncio'> & {
  pokemon: UnidadPokemon;
} {
  const { roster, items, locale } = context;
  const id = pokemonOf(unit.pokemon, roster);
  const ditto = isDittoSlug(id);
  const addons = id === null ? [] : (context.addons[id] ?? []);
  const slots = ditto ? within(unit.memorySlots, LIMITS.memorySlots) : null;
  const nickname = unit.nickname.trim();
  const ball = unit.ball.trim();
  const addon = addons.find((entry) => entry.id === unit.addon);
  const npcAmount = unit.npc === 'amount' ? parsePokedolares(unit.npcAmount, locale) : null;

  return {
    ditto,
    addons,
    pokemon: {
      pokemon: id ?? '',
      ball: ball === '' ? null : { item: itemOf(items, ball, BALL_CATEGORY), nombre: ball },
      aura: unit.aura === '' ? null : unit.aura,
      boost: within(unit.boost, LIMITS.boost),
      starLevel: within(unit.starLevel, LIMITS.starLevel),
      nickname: nickname === '' ? null : nickname,
      memorySlots: slots,
      memorias:
        slots === null
          ? []
          : unit.memories.slice(0, slots).map((memory) => pokemonOf(memory, roster)),
      helds: unit.helds.flatMap((held) => {
        const name = held.name.trim();
        const tier = within(held.tier, LIMITS.tier);
        if (name === '' || tier === null) return [];
        return [{ item: itemOf(items, name, HELD_CATEGORY), nombre: name, tier }];
      }),
      addon: addon === undefined ? null : { id: addon.id, nombre: addon.nombre },
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
  const { locale, items } = context;
  const base = { tipo: draft.tipo, precio: readPrice(draft, locale), mundo: draft.world };
  if (draft.tipo === 'pokemon') {
    const { pokemon, ditto, addons } = readUnit(draft.pokemon, context);
    return { anuncio: { ...base, pokemon }, ditto, addons };
  }
  if (draft.tipo === 'items') {
    const name = draft.item.name.trim();
    const cantidad = parsePositiveWhole(draft.item.quantity, locale) ?? Number.NaN;
    const item = name === '' ? {} : { item: { item: itemOf(items, name), nombre: name, cantidad } };
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
  held: (index: number) => `lf-held-${index}`,
  heldTier: (index: number) => `lf-held-${index}-tier`,
  addon: 'lf-addon',
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
  world: 'lf-world',
  copy: 'lf-copy',
  text: 'lf-text',
} as const;

/** The fields of the folding «Entrenamiento» (9.7.5). */
const TRAINING_FIELD = /^lf-train-/;

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
function validate(
  draft: Draft,
  reading: Reading,
  context: Context,
  messages: ListingFormErrors,
  worlds: number,
): Validation {
  const { locale } = context;
  const errors: Record<string, string> = {};
  const order: string[] = [];
  const check = (id: string, message: string | null) => {
    order.push(id);
    if (message !== null) errors[id] = message;
  };
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
      const slots = within(unit.memorySlots, LIMITS.memorySlots) ?? 0;
      unit.memories.slice(0, slots).forEach((memory, index) => {
        const unknown = memory.text.trim() !== '' && pokemonOf(memory, context.roster) === null;
        check(ID.memory(index), unknown ? messages.pokemon : null);
      });
    }
    unit.helds.forEach((held, index) => {
      check(ID.held(index), null);
      check(
        ID.heldTier(index),
        held.name.trim() === '' ? null : number(held.tier, LIMITS.tier, true),
      );
    });
    if (reading.addons.length > 0) check(ID.addon, null);
    check(ID.nextBoostChance, ratio(unit.nextBoostChance));
    unit.training.forEach((row, index) => {
      check(ID.trainLevel(index), number(row.level, LIMITS.level));
      check(ID.trainProgress(index), ratio(row.progress));
    });
    if (unit.npc === 'amount') check(ID.npcAmount, pokedolares(unit.npcAmount));
  } else if (draft.tipo === 'items') {
    check(ID.item, draft.item.name.trim() === '' ? messages.item : null);
    check(ID.itemQuantity, whole(draft.item.quantity));
  } else if (draft.tipo === 'diamonds') {
    check(ID.diamonds, whole(draft.diamonds));
  } else {
    check(ID.pokedolares, pokedolares(draft.pokedolares));
  }

  const { price } = draft;
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
  if (worlds > 0) check(ID.world, draft.world === '' ? messages.world : null);
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
  wide?: boolean;
  children: ReactNode;
}

/** A field and the error line under it (9.7.5). */
function Field({ id, error, wide = false, children }: FieldProps) {
  return (
    <div
      className={wide ? 'ac-listing-form__field ac-listing-form__wide' : 'ac-listing-form__field'}
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

/** The fieldset of a part of the form, with its legend and its content 8 under it. */
function Group({
  legend,
  strong = false,
  wide = false,
  children,
}: {
  legend: string;
  strong?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      className={wide ? 'ac-listing-form__set ac-listing-form__wide' : 'ac-listing-form__set'}
    >
      <legend
        className={
          strong
            ? 'ac-listing-form__legend ac-listing-form__legend--strong'
            : 'ac-listing-form__legend'
        }
      >
        {legend}
      </legend>
      <div className="ac-listing-form__group">{children}</div>
    </fieldset>
  );
}

/** The preview, a chunk of its own that the first render never needs (13.6, 9.7.6). */
const ListingPreview = lazy(() =>
  import('./ListingPreview').then((module) => ({ default: module.ListingPreview })),
);

type CopyState = { state: 'idle' } | { state: 'copied' } | { state: 'failed'; text: string };

export function ListingForm(props: ListingFormProps) {
  const { locale, labels, ui, sprites, worlds, auras, addons } = props;
  const roster = useData(props.pokedexUrl, readRoster);
  const items = useData(props.itemsUrl, readItems);
  const rosterData = roster.state === 'ready' ? roster.data : null;
  const itemsData = items.state === 'ready' ? items.data : null;

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [copy, setCopy] = useState<CopyState>({ state: 'idle' });
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
  // form, so hydration renders it too.
  useEffect(() => {
    const stored = readStoredDraft();
    if (stored === null) return;
    setDraft(stored);
    const trained = stored.pokemon.training.some(
      (row) => row.level !== null || row.progress.trim() !== '',
    );
    if (trained) setTrainingOpen(true);
  }, []);

  useEffect(() => {
    if (edited.current) storeDraft(draft);
  }, [draft]);

  useEffect(() => {
    if (focusNext === null) return;
    setFocusNext(null);
    document.getElementById(focusNext)?.focus();
  }, [focusNext]);

  // A failed copy puts the text in a read-only field and selects it, so one shortcut copies it
  // (9.7.7).
  useEffect(() => {
    if (copy.state !== 'failed') return;
    const area = document.getElementById(ID.text);
    if (area instanceof HTMLTextAreaElement) {
      area.focus();
      area.select();
    }
  }, [copy]);

  const context: Context = { locale, roster: rosterData, items: itemsData, addons };
  const reading = readDraft(draft, context);
  const validation = validate(draft, reading, context, labels.errors, worlds.length);
  const shown: Record<string, string> = {};
  for (const id of validation.order) {
    const message = validation.errors[id];
    if (message !== undefined && (submitted || touched.has(id))) shown[id] = message;
  }

  useLayoutEffect(() => {
    if (formRef.current !== null) markInvalid(formRef.current, shown);
  });

  // The names the title and the copied text read (9.4). Until the roster arrives, a Pokémon of a
  // restored draft is called what its field says.
  const typedNames = new Map<string, string>();
  for (const choice of [draft.pokemon.pokemon, ...draft.pokemon.memories]) {
    if (choice.id !== null) typedNames.set(choice.id, choice.text);
  }
  const names: ListingNames = {
    pokemon: (id) => rosterData?.byId.get(id)?.nombre ?? typedNames.get(id),
    item: (id) => itemsData?.byId.get(id)?.nombre,
    addon: (id) => addonNames.get(id),
    aura: (id) => auraNames[id],
    mundo: (id) => worldNames[id],
    vendedor: () => undefined,
  };

  const previewLabels = useMemo<ListingPreviewLabels>(
    () => ({
      card: { ...props.preview.card, shiny: ui.shiny, money: ui.money },
      tooltip: ui.tooltip,
      now: props.preview.now,
      unsellable: props.preview.unsellable,
    }),
    [props.preview, ui],
  );

  const previewData = useMemo<ListingPreviewData>(
    () => ({
      pokemon: rosterData?.byId ?? new Map(),
      elements: rosterData?.elements ?? {},
      items: itemsData?.byId ?? new Map(),
      itemRefs: itemsData?.refs ?? { elementos: {}, pokemon: {} },
      categories: props.categories,
      auras: auraNames,
      worlds: worldNames,
      sprites,
      diamonds: props.diamonds,
    }),
    [rosterData, itemsData, props.categories, auraNames, worldNames, sprites, props.diamonds],
  );

  // ------------------------------------------------------------------------- changes

  /** A change of the reader: the draft, and the end of the last copy's notice. */
  function update(change: (current: Draft) => Draft) {
    edited.current = true;
    setDraft(change);
    setCopy({ state: 'idle' });
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

  function choosePokemon(pokemon: Choice) {
    setUnit((unit) => {
      const id = pokemonOf(pokemon, rosterData);
      const own = id === null ? [] : (addons[id] ?? []);
      return {
        ...unit,
        pokemon,
        // 9.7.2: one Memory Slot by default when the Pokémon becomes a Ditto.
        memorySlots:
          isDittoSlug(id) && unit.memorySlots === null ? LIMITS.memorySlots[0] : unit.memorySlots,
        addon: own.some((addon) => addon.id === unit.addon) ? unit.addon : '',
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

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopy({ state: 'copied' });
    } catch {
      setCopy({ state: 'failed', text: value });
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const first = validation.order.find((id) => validation.errors[id] !== undefined);
    if (first === undefined) {
      setSubmitted(true);
      // A new copy is a new status: the Notice of the last one goes, so the next one is read.
      setCopy({ state: 'idle' });
      void copyText(listingText(reading.anuncio, locale, names, props.text));
      return;
    }
    // 9.7.5: every error shows, and the focus goes to the first invalid field; one inside the
    // folded «Entrenamiento» opens it before. The errors are committed first, so the field
    // already says it is invalid, and why, when a screen reader announces it on focus.
    flushSync(() => {
      setSubmitted(true);
      if (TRAINING_FIELD.test(first)) setTrainingOpen(true);
    });
    document.getElementById(first)?.focus();
  }

  function closeNotice() {
    const focused = document.activeElement;
    const inside = focused instanceof Element && focused.closest('.ac-notice') !== null;
    setCopy({ state: 'idle' });
    // DS:Notice: the focus goes back to the control the notice came from.
    if (inside) document.getElementById(ID.copy)?.focus();
  }

  // -------------------------------------------------------------------------- fields

  /** The attributes of an input: its error, and the leaving that ends its first interaction. */
  const invalid = (id: string) => ({
    onBlur: () => left(id),
    'aria-invalid': shown[id] === undefined ? undefined : (true as const),
    'aria-describedby': shown[id] === undefined || shown[id] === '' ? undefined : errorId(id),
  });

  const pokemonOptions = (value: string): ComboboxOption[] =>
    rosterMatches(rosterData, value).map((row) => {
      const art = resolvePokemonImage(row.imagen);
      return {
        value: row.id,
        label: row.nombre,
        meta: row.numero === null ? undefined : fill(ui.cards.number, { n: String(row.numero) }),
        media:
          art === null ? null : <Sprite src={art} smooth width={40} height={40} loading="lazy" />,
        mark: row.variante === 'shiny' ? <ShinyMark /> : undefined,
      };
    });

  const itemOptions = (value: string, category?: string): ComboboxOption[] =>
    containing(itemsData, value, (row) => category === undefined || row.categoria === category).map(
      (row) => ({
        value: row.id,
        label: row.nombre,
        media: row.sprite === null ? null : <Sprite {...row.sprite} />,
      }),
    );

  const pokemonCombobox = (
    id: string,
    label: string,
    value: Choice,
    onChoice: (next: Choice) => void,
    required = false,
  ) => (
    <Combobox
      id={id}
      label={label}
      options={pokemonOptions(value.text)}
      value={value.text}
      maxLength={NOMBRE_MAX}
      required={required}
      // Without the roster nothing can be chosen: the field says so once, under the Pokémon.
      helper={required && roster.state === 'error' ? ui.dataError : undefined}
      inputProps={invalid(id)}
      onChange={(next) => {
        typed(id);
        onChoice({ text: next, id: named(rosterData, next)?.id ?? null });
      }}
      onSelect={(option) => {
        // A choice from the list ends the interaction.
        changed.current.delete(id);
        touch(id);
        onChoice({ text: option.label, id: option.value });
      }}
    />
  );

  const itemCombobox = (
    id: string,
    label: string,
    value: string,
    onName: (next: string) => void,
    category?: string,
  ) => (
    <Combobox
      id={id}
      label={label}
      options={itemOptions(value, category)}
      value={value}
      freeText
      required={category === undefined}
      maxLength={category === undefined ? NOMBRE_ITEM_MAX : NOMBRE_MAX}
      inputProps={invalid(id)}
      onChange={(next) => {
        typed(id);
        onName(next);
      }}
      onSelect={(option) => {
        changed.current.delete(id);
        touch(id);
        onName(option.label);
      }}
    />
  );

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

  const numberField = (
    id: string,
    label: string,
    value: number | null,
    [min, max]: readonly [number, number],
    onNumber: (next: number | null) => void,
    helper?: string,
  ) => (
    <NumberField
      id={id}
      label={label}
      value={value}
      min={min}
      max={max}
      helper={helper}
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

  const setHeld = (index: number, change: Partial<HeldRow>) =>
    setUnit((current) => ({
      ...current,
      helds: current.helds.map((row, position) =>
        position === index ? { ...row, ...change } : row,
      ),
    }));

  const setTraining = (index: number, change: Partial<TrainingRow>) =>
    setUnit((current) => ({
      ...current,
      training: current.training.map((row, position) =>
        position === index ? { ...row, ...change } : row,
      ),
    }));

  const setMemory = (index: number, memory: Choice) =>
    setUnit((current) => ({
      ...current,
      memories: current.memories.map((entry, position) => (position === index ? memory : entry)),
    }));

  const auraOptions: ToggleGroupOption[] = [
    { value: '', label: labels.auraNone },
    ...auras.map((aura) => ({
      value: aura.id,
      label: aura.nombre,
      ...(aura.icono === null ? {} : { sprite: aura.icono }),
    })),
  ];

  const npcOptions: ToggleGroupOption[] = [
    { value: 'none', label: labels.npcNone },
    { value: 'unsellable', label: labels.npcUnsellable },
    { value: 'amount', label: labels.amount },
  ];

  const pokemonFields = (
    <div className="ac-listing-form__fields">
      <Field id={ID.pokemon} error={shown[ID.pokemon]} wide>
        {pokemonCombobox(ID.pokemon, labels.pokemon, unit.pokemon, choosePokemon, true)}
      </Field>
      <Field id={ID.nickname} error={shown[ID.nickname]}>
        {textField(
          ID.nickname,
          labels.nickname,
          unit.nickname,
          (nickname) => setUnit((current) => ({ ...current, nickname })),
          { max: NOMBRE_MAX },
        )}
      </Field>
      <Field id={ID.ball} error={shown[ID.ball]}>
        {itemCombobox(
          ID.ball,
          labels.ball,
          unit.ball,
          (ball) => setUnit((current) => ({ ...current, ball })),
          BALL_CATEGORY,
        )}
      </Field>
      {auras.length > 0 ? (
        <div className="ac-listing-form__wide">
          <ToggleGroup
            id="lf-aura"
            variant="sprite"
            label={labels.aura}
            labelHidden={false}
            options={auraOptions}
            value={unit.aura}
            onChange={(aura) => setUnit((current) => ({ ...current, aura }))}
          />
        </div>
      ) : null}
      <Field id={ID.boost} error={shown[ID.boost]}>
        {numberField(
          ID.boost,
          labels.boost,
          unit.boost,
          LIMITS.boost,
          (boost) => setUnit((current) => ({ ...current, boost })),
          labels.boostHelp,
        )}
      </Field>
      <Field id={ID.starLevel} error={shown[ID.starLevel]}>
        {numberField(
          ID.starLevel,
          labels.starLevel,
          unit.starLevel,
          LIMITS.starLevel,
          (starLevel) => setUnit((current) => ({ ...current, starLevel })),
        )}
      </Field>
      {reading.ditto ? (
        <Field id={ID.memorySlots} error={shown[ID.memorySlots]}>
          {numberField(
            ID.memorySlots,
            labels.memorySlots,
            unit.memorySlots,
            LIMITS.memorySlots,
            (memorySlots) => setUnit((current) => ({ ...current, memorySlots })),
          )}
        </Field>
      ) : null}
      {unit.memories.slice(0, slots).map((memory, index) => (
        // The Memory Slots are a fixed sequence of the Ditto: the position is the identity.
        <Field key={index} id={ID.memory(index)} error={shown[ID.memory(index)]}>
          {pokemonCombobox(
            ID.memory(index),
            fill(labels.memory, { n: formatInteger(index + 1, locale) }),
            memory,
            (next) => setMemory(index, next),
          )}
        </Field>
      ))}
      <Group legend={labels.heldItems} strong wide>
        {unit.helds.map((held, index) => (
          // The held items are the two fixed fields of the Pokémon: the position is the identity.
          <div key={index} className="ac-listing-form__pair ac-listing-form__pair--tier">
            <Field id={ID.held(index)} error={shown[ID.held(index)]}>
              {itemCombobox(
                ID.held(index),
                fill(labels.heldItem, { n: formatInteger(index + 1, locale) }),
                held.name,
                (name) => setHeld(index, { name }),
                HELD_CATEGORY,
              )}
            </Field>
            <Field id={ID.heldTier(index)} error={shown[ID.heldTier(index)]}>
              {numberField(ID.heldTier(index), labels.tier, held.tier, LIMITS.tier, (tier) =>
                setHeld(index, { tier }),
              )}
            </Field>
          </div>
        ))}
      </Group>
      {reading.addons.length > 0 ? (
        <Field id={ID.addon}>
          <Select
            id={ID.addon}
            label={labels.addon}
            options={[
              { value: '', label: labels.addonNone },
              ...reading.addons.map((addon) => ({ value: addon.id, label: addon.nombre })),
            ]}
            value={unit.addon}
            onChange={(addon) => setUnit((current) => ({ ...current, addon }))}
          />
        </Field>
      ) : null}
      <Field id={ID.nextBoostChance} error={shown[ID.nextBoostChance]}>
        {textField(
          ID.nextBoostChance,
          labels.nextBoostChance,
          unit.nextBoostChance,
          (nextBoostChance) => setUnit((current) => ({ ...current, nextBoostChance })),
          { inputMode: 'decimal' },
        )}
      </Field>
      <details
        className="ac-listing-form__fold ac-listing-form__wide"
        open={trainingOpen}
        onToggle={(event) => setTrainingOpen(event.currentTarget.open)}
      >
        <summary className="ac-listing-form__fold-summary">
          {labels.training}
          <Glyph
            name="chevron-down"
            size={16}
            className="ac-listing-form__fold-chevron ac-listing-form__fold-chevron--closed"
          />
          <Glyph
            name="chevron-up"
            size={16}
            className="ac-listing-form__fold-chevron ac-listing-form__fold-chevron--open"
          />
        </summary>
        <div className="ac-listing-form__fold-body">
          {HABILIDADES.map((skill, index) => {
            const row = unit.training[index];
            return (
              <Group key={skill} legend={skill} strong>
                <div className="ac-listing-form__pair">
                  <Field id={ID.trainLevel(index)} error={shown[ID.trainLevel(index)]}>
                    {numberField(
                      ID.trainLevel(index),
                      labels.level,
                      row.level,
                      LIMITS.level,
                      (level) => setTraining(index, { level }),
                    )}
                  </Field>
                  <Field id={ID.trainProgress(index)} error={shown[ID.trainProgress(index)]}>
                    {textField(
                      ID.trainProgress(index),
                      labels.progress,
                      row.progress,
                      (progress) => setTraining(index, { progress }),
                      { inputMode: 'decimal' },
                    )}
                  </Field>
                </div>
              </Group>
            );
          })}
        </div>
      </details>
      <div className="ac-listing-form__stack ac-listing-form__wide">
        <ToggleGroup
          id="lf-npc"
          label={labels.npcPrice}
          labelHidden={false}
          options={npcOptions}
          value={unit.npc}
          onChange={(npc) =>
            setUnit((current) => ({ ...current, npc: looseOneOf(npc, NPC_CHOICES, 'none') }))
          }
        />
        {unit.npc === 'amount' ? (
          <div className="ac-listing-form__fields">
            <Field id={ID.npcAmount} error={shown[ID.npcAmount]}>
              {textField(ID.npcAmount, labels.amount, unit.npcAmount, (npcAmount) =>
                setUnit((current) => ({ ...current, npcAmount })),
              )}
            </Field>
          </div>
        ) : null}
      </div>
    </div>
  );

  // ------------------------------------------------------------- items and currencies

  const assetFields =
    draft.tipo === 'pokemon' ? (
      pokemonFields
    ) : draft.tipo === 'items' ? (
      <div className="ac-listing-form__fields">
        <Field id={ID.item} error={shown[ID.item]}>
          {itemCombobox(ID.item, labels.item, draft.item.name, (name) =>
            update((current) => ({ ...current, item: { ...current.item, name } })),
          )}
        </Field>
        <Field id={ID.itemQuantity} error={shown[ID.itemQuantity]}>
          {textField(ID.itemQuantity, labels.quantity, draft.item.quantity, (quantity) =>
            update((current) => ({ ...current, item: { ...current.item, quantity } })),
          )}
        </Field>
      </div>
    ) : draft.tipo === 'diamonds' ? (
      <div className="ac-listing-form__fields">
        <Field id={ID.diamonds} error={shown[ID.diamonds]}>
          {textField(ID.diamonds, labels.quantity, draft.diamonds, (diamonds) =>
            update((current) => ({ ...current, diamonds })),
          )}
        </Field>
      </div>
    ) : (
      <div className="ac-listing-form__fields">
        <Field id={ID.pokedolares} error={shown[ID.pokedolares]}>
          {textField(
            ID.pokedolares,
            labels.quantity,
            draft.pokedolares,
            (pokedolares) => update((current) => ({ ...current, pokedolares })),
            { helper: exactFigure(draft.pokedolares) },
          )}
        </Field>
      </div>
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

  const priceFields = (
    <Group legend={labels.price} strong>
      <Group legend={labels.fiat}>
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
      </Group>
      <Group legend={labels.game}>
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
      </Group>
      <Checkbox
        id={ID.negotiable}
        label={labels.negotiable}
        checked={price.negotiable}
        onChange={(checked) => setNegotiable(checked)}
      />
    </Group>
  );

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

  const typeOptions: ToggleGroupOption[] = TIPOS_ACTIVO.map((tipo) => {
    const sprite = sprites.tabs[tipo];
    return { value: tipo, label: labels.types[tipo], ...(sprite === null ? {} : { sprite }) };
  });

  return (
    <div className="ac-listing-form">
      <form ref={formRef} className="ac-listing-form__form" noValidate onSubmit={submit}>
        <ToggleGroup
          id="lf-type"
          variant="tab"
          label={labels.assetType}
          labelHidden={false}
          strong
          options={typeOptions}
          value={draft.tipo}
          onChange={(tipo) => chooseType(looseOneOf(tipo, TIPOS_ACTIVO, draft.tipo))}
        />
        {assetFields}
        {priceFields}
        {worlds.length > 0 ? (
          <div className="ac-listing-form__fields">
            <Field id={ID.world} error={shown[ID.world]}>
              <Select
                id={ID.world}
                label={labels.world}
                options={worlds.map((world) => ({ value: world.id, label: world.nombre }))}
                value={draft.world}
                onChange={(world) => {
                  touch(ID.world);
                  update((current) => ({ ...current, world }));
                }}
              />
            </Field>
          </div>
        ) : null}
        <div className="ac-listing-form__action">
          <Button id={ID.copy} type="submit" variant="solid">
            {labels.copy}
          </Button>
          <Notice open={copy.state !== 'idle'} onClose={closeNotice} closeLabel={ui.dismiss}>
            {copy.state === 'failed' ? labels.copyFailed : labels.copied}
          </Notice>
          {copy.state === 'failed' ? (
            <Textarea
              id={ID.text}
              label={labels.copyText}
              value={copy.text}
              rows={Math.min(Math.max(copy.text.split('\n').length, 4), 16)}
              textareaProps={{ readOnly: true }}
            />
          ) : null}
        </div>
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
            />
          </Suspense>
        </section>
      ) : null}
    </div>
  );
}
