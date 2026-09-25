// Build-time loaders for the owner-editable registries (D-011): Market
// categories and items, Pokémon outfits and addons, auras, the elements, the system
// pages of content/sistemas/, the Destacados and the worlds of the Inicio, the
// entries of Cambios and the sprite registry. Every file is read through `@content`
// and parsed with the Zod mirror of content/schemas, so a malformed file fails the
// build with its path. Pages and components read content/ only through these
// functions and those of repository.ts, never a JSON of content/ directly (spec 3.12).
import aurasFile from '@content/auras.json';
import categoriasFile from '@content/items/categorias.json';
import elementosFile from '@content/elementos.json';
import outfitsFile from '@content/outfits.json';
import spritesFile from '../../../public/sprites/sprites.json';
import { z } from 'zod';

import type { Locale } from '@/i18n/config';
import type { SpriteRegistry } from '@/lib/sprites/resolve';
import {
  aurasFileSchema,
  cambiosFileSchema,
  categoriasFileSchema,
  destacadosFileSchema,
  elementosFileSchema,
  itemCategoryIds,
  itemsFileSchema,
  mundosFileSchema,
  outfitsFileSchema,
  sistemaFileSchema,
  spritesFileSchema,
  type Aura,
  type Cambio,
  type Categoria,
  type Destacado,
  type Elemento,
  type Item,
  type Moneda,
  type Mundo,
  type OutfitRecord,
  type Sistema,
} from './registry-schema';

type Draftable = { borrador?: boolean };

function parse<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${file} no es válido:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** The build flag from .env files (import.meta.env) or the shell/Vercel (process.env). */
function buildEnv(): Record<string, unknown> {
  return {
    OCULTAR_BORRADORES:
      import.meta.env.OCULTAR_BORRADORES ??
      (typeof process === 'undefined' ? undefined : process.env.OCULTAR_BORRADORES),
  };
}

/**
 * Draft records are shown by default. A build with OCULTAR_BORRADORES=1 (or
 * true) leaves them out.
 */
export function hideDrafts(env: Record<string, unknown> = buildEnv()): boolean {
  const value = String(env.OCULTAR_BORRADORES ?? '').toLowerCase();
  return value === '1' || value === 'true';
}

export function withoutDrafts<T extends Draftable>(records: T[], hide = hideDrafts()): T[] {
  return hide ? records.filter((record) => record.borrador !== true) : records;
}

/** `stones` for `/content/items/stones.json`: the name of a globbed file without `.json`. */
function fileName(modulePath: string): string {
  return (
    modulePath
      .split('/')
      .pop()
      ?.replace(/\.json$/, '') ?? ''
  );
}

const itemModules = import.meta.glob<unknown>('@content/items/*.json', {
  eager: true,
  import: 'default',
});

const categorias = parse(categoriasFileSchema, categoriasFile, 'content/items/categorias.json')
  .categorias.slice()
  .sort((a, b) => a.orden - b.orden);

const itemsByCategory = new Map<string, Item[]>();
/** The `moneda` object of content/items/diamantes.json (§3.13), or `null` without it. */
let monedaDiamantes: Moneda | null = null;
for (const [modulePath, data] of Object.entries(itemModules)) {
  const name = fileName(modulePath);
  if (name === 'categorias') continue;
  const file = `content/items/${name}.json`;
  if (!itemCategoryIds.includes(name))
    throw new Error(`${file}: no hay una categoría "${name}" en content/items/categorias.json.`);
  const parsed = parse(itemsFileSchema, data, file);
  const items = parsed.items;
  // `pnpm content:check` refuses the object in any other items file.
  if (name === 'diamantes') monedaDiamantes = parsed.moneda ?? null;
  const misplaced = items.find((item) => item.categoria !== name);
  if (misplaced)
    throw new Error(`${file}: el item ${misplaced.id} es de "${misplaced.categoria}".`);
  itemsByCategory.set(name, items);
}

// System pages (§3.13, §8.4): one file per page, named after its `id`, which is the slug of
// its route. The files are read in the order of `orden`; two with the same `orden` keep the
// order of their `id`, so the build never depends on the order of the file system.
const sistemaModules = import.meta.glob<unknown>('@content/sistemas/*.json', {
  eager: true,
  import: 'default',
});

const sistemas: Sistema[] = Object.entries(sistemaModules)
  .map(([modulePath, data]) => {
    const name = fileName(modulePath);
    const file = `content/sistemas/${name}.json`;
    const sistema = parse(sistemaFileSchema, data, file);
    if (sistema.id !== name)
      throw new Error(`${file}: el id es "${sistema.id}" y debe ser "${name}", el del archivo.`);
    return sistema;
  })
  .sort((a, b) => a.orden - b.orden || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

const outfits = parse(outfitsFileSchema, outfitsFile, 'content/outfits.json').outfits;
const auras = parse(aurasFileSchema, aurasFile, 'content/auras.json').auras;
const elementos = parse(elementosFileSchema, elementosFile, 'content/elementos.json').elementos;
const sprites = parse(spritesFileSchema, spritesFile, 'public/sprites/sprites.json')
  .sprites as SpriteRegistry;

// The two registries of the Inicio (§3.13, §8.1) may be missing: without content/destacados.json
// there is no Destacados section and no pinned menu group, and without content/mundos.json no
// Worlds table (§8.1, «Estados»). The folder `@content` points at in the visual build
// (tests/visual/content/, §14.5) may lack them too. A glob of one literal path is how Vite
// imports a file that may not exist: the object is empty then, and a file that exists is still
// parsed with its Zod mirror.
const destacadosModules = import.meta.glob<unknown>('@content/destacados.json', {
  eager: true,
  import: 'default',
});
const mundosModules = import.meta.glob<unknown>('@content/mundos.json', {
  eager: true,
  import: 'default',
});

/** The parsed content of an optional file, or `undefined` when the file does not exist. */
function parseOptional<T>(
  schema: z.ZodType<T>,
  modules: Record<string, unknown>,
  file: string,
): T | undefined {
  const [data] = Object.values(modules);
  return data === undefined ? undefined : parse(schema, data, file);
}

const destacados =
  parseOptional(destacadosFileSchema, destacadosModules, 'content/destacados.json')?.destacados ??
  [];
const mundos = parseOptional(mundosFileSchema, mundosModules, 'content/mundos.json')?.mundos ?? [];

// Cambios (§3.13, §8.7) is written by hand (R10) and may be missing too, like the two registries
// of the Inicio: without the file, or in the visual build, whose folder has none, the page has no
// entries and shows its empty state.
const cambiosModules = import.meta.glob<unknown>('@content/cambios.json', {
  eager: true,
  import: 'default',
});
const cambios =
  parseOptional(cambiosFileSchema, cambiosModules, 'content/cambios.json')?.cambios ?? [];

/** The 14 Market categories in client order («Todo» first), the site's own ones and «Otros». */
export function getCategorias(): Categoria[] {
  return categorias;
}

/** Items of one category, or of every category for "todo" / no argument. */
export function getItems(categoria?: string): Item[] {
  const selected =
    categoria === undefined || categorias.find((entry) => entry.id === categoria)?.virtual
      ? categorias.flatMap((entry) => itemsByCategory.get(entry.id) ?? [])
      : (itemsByCategory.get(categoria) ?? []);
  return withoutDrafts(selected);
}

export function getItem(id: string): Item | undefined {
  return getItems().find((item) => item.id === id);
}

/**
 * Helds of one slot (§16.2.3, `HeldPicker`): items with `categoria === "helds"` and
 * `held.ranura` equal to `ranura`, in the order of the file. Every item of `categoria`
 * `"helds"` has `held` (the schema requires it); a held whose slot the game does not say
 * (`ranura: null`) is in neither slot.
 */
export function getHeldsBySlot(ranura: 'x' | 'y'): Item[] {
  return getItems('helds').filter((item) => item.held?.ranura === ranura);
}

/**
 * Mega Stones (§16.2.3, `MegaPicker`): items of any category with a `mega` object, in the
 * order of the registry; when `pokemon` is given, the Mega Stones of that Pokémon come first
 * (§16.3.3), the rest keep the registry order.
 */
export function getMegaStones(pokemon?: string): Item[] {
  const stones = getItems().filter((item) => item.mega !== undefined);
  if (pokemon === undefined) return stones;
  const own = stones.filter((item) => item.mega?.pokemon.includes(pokemon));
  const rest = stones.filter((item) => !item.mega?.pokemon.includes(pokemon));
  return [...own, ...rest];
}

/** The game's name of the premium currency in a shop price (`obtencion.tiendas[].moneda`). */
const DIAMONDS = 'Diamonds';

/**
 * The `moneda` object of content/items/diamantes.json (§3.13): where players buy Diamonds and what
 * they spend them on, one list per locale. Its lists are the rows of the Diamonds panel
 * (`diamondsTip`, §7.5.3) and the facts «Se compran en» and «Se usan en» of a Diamonds listing
 * (§9.5.8). `null` when the file has no such object; a list is `null` while the owner has not
 * filled it, and then it makes no row (R2) — except «Se usan en», which the registries already
 * answer while the owner has not written it: the game shops whose `obtencion.tiendas` price items
 * in Diamonds (Diamond Shop), game names that read the same in both locales (13.4).
 */
export function getMonedaDiamantes(): Moneda | null {
  if (monedaDiamantes === null || monedaDiamantes.seUsanEn !== null) return monedaDiamantes;
  const shops = new Set<string>();
  for (const item of getItems()) {
    for (const shop of item.obtencion?.tiendas ?? []) {
      if (shop.moneda === DIAMONDS) shops.add(shop.tienda);
    }
  }
  if (shops.size === 0) return monedaDiamantes;
  const list = [...shops];
  return { ...monedaDiamantes, seUsanEn: { es: list, en: list } };
}

/** Pokémon outfits with their addons; drafts follow OCULTAR_BORRADORES. */
export function getOutfits(): OutfitRecord[] {
  return withoutDrafts(outfits).map((outfit) => ({
    ...outfit,
    addons: withoutDrafts(outfit.addons),
  }));
}

export function getOutfitForPokemon(pokemon: string): OutfitRecord | undefined {
  return getOutfits().find((outfit) => outfit.pokemon === pokemon);
}

export function getAuras(): Aura[] {
  return withoutDrafts(auras);
}

/** The 18 elements of spec 8.0.5, in its order: the order of every filter and list of them. */
export function getElementos(): Elemento[] {
  return elementos;
}

/**
 * The system pages of content/sistemas/ in `orden` (§8.4): the pages the build writes, the
 * «Sistemas» group of the menu, the systems index, the Inicio panel and the search group
 * `sistema`. Drafts follow OCULTAR_BORRADORES, so with it a draft has no page and appears
 * nowhere (SI4).
 */
export function getSistemas(): Sistema[] {
  return withoutDrafts(sistemas);
}

/** The system page with this `id`, or `undefined` when it has no page in this build. */
export function getSistema(id: string): Sistema | undefined {
  return getSistemas().find((sistema) => sistema.id === id);
}

/**
 * The system with this `id` or the item with this `id`, drafts included even under
 * OCULTAR_BORRADORES, or `undefined` when content/ has no such record. Only for the name of a
 * mention: `pnpm content:check` resolves every mention against every record, drafts included,
 * so a published system page may still name a draft that such a build hides, and it shows that
 * name as text, without a page or a panel (SI4, R2). Everything else reads `getSistemas` and
 * `getItems`, which leave hidden drafts out.
 */
export function getSistemaIncluidoBorrador(id: string): Sistema | undefined {
  return sistemas.find((sistema) => sistema.id === id);
}

/** See `getSistemaIncluidoBorrador`. */
export function getItemIncluidoBorrador(id: string): Item | undefined {
  for (const items of itemsByCategory.values()) {
    const item = items.find((entry) => entry.id === id);
    if (item !== undefined) return item;
  }
  return undefined;
}

/**
 * The Destacados of content/destacados.json (§3.13), in the order of the file: the
 * `FeaturedSection` of the Inicio, Buscar and the 404 (§8.1, §8.6, §8.12) and the pinned
 * «Destacados» group of the menu (§8.0.3). Each `ruta` is a page the build writes, without its
 * locale (`pnpm content:check`). Drafts follow OCULTAR_BORRADORES; without the file, or with
 * every entry a hidden draft, the list is empty and nothing is drawn.
 */
export function getDestacados(): Destacado[] {
  return withoutDrafts(destacados);
}

/**
 * Worlds in the order of §3.13: by `nombre` with `Intl.Collator(locale, { numeric: true })`, so
 * «Titan 2» comes before «Titan 10». The sort is stable and returns a new array.
 */
export function sortMundos(records: readonly Mundo[], locale: Locale): Mundo[] {
  const collator = new Intl.Collator(locale, { numeric: true });
  return [...records].sort((a, b) => collator.compare(a.nombre, b.nombre));
}

/**
 * The worlds of content/mundos.json (§3.13) in the order of `sortMundos` for this locale: the
 * rows of `WorldsTable` (§8.1), and the list that §9.5.4 (Comercio) and §10.5 (Guild) read too.
 * Empty without the file.
 */
export function getMundos(locale: Locale): Mundo[] {
  return sortMundos(mundos, locale);
}

/**
 * Entries in the order of the Cambios page (8.7 step 4): by `fecha` descending, and the entries
 * of one day by `id`. `fecha` is `AAAA-MM-DD`, so comparing the strings compares the days. The
 * sort is stable and returns a new array.
 */
export function sortCambios(records: readonly Cambio[]): Cambio[] {
  return [...records].sort((a, b) =>
    a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}

/** The entries of one month of the Cambios page: one `Section` with its `Timeline` (8.7). */
export interface MesDeCambios {
  /** `AAAA-MM`: the `id` of the section and the target of its `Toc` entry (8.7 step 3). */
  id: string;
  /** Its entries, in the order of `sortCambios`. */
  cambios: Cambio[];
}

/**
 * The months of the Cambios page (8.7 step 3): one per month with entries, the most recent
 * first, each with its entries in the order of `sortCambios`. No entry, no month.
 */
export function groupCambiosByMonth(records: readonly Cambio[]): MesDeCambios[] {
  const months: MesDeCambios[] = [];
  for (const cambio of sortCambios(records)) {
    const id = cambio.fecha.slice(0, 7);
    const last = months.at(-1);
    if (last?.id === id) last.cambios.push(cambio);
    else months.push({ id, cambios: [cambio] });
  }
  return months;
}

/**
 * The entries of content/cambios.json (§3.13) in the order of `sortCambios`: the Cambios page
 * (8.7). Drafts follow OCULTAR_BORRADORES; without the file the list is empty and the page shows
 * «Aún no hay cambios publicados.».
 */
export function getCambios(): Cambio[] {
  return sortCambios(withoutDrafts(cambios));
}

export function getSpriteRegistry(): SpriteRegistry {
  return sprites;
}
