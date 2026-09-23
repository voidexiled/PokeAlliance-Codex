// The search index of spec 7.9.1 and 8.6, one prerendered JSON per locale. The
// palette downloads it on its first opening and the results page of spec 8.6
// reads the same file, so there is one index and one ranking for both.
//
// Rule BU6 / WG5: an entry only exists when its route exists in the build. This
// is why the file grew milestone by milestone — M8 added `sistema` and the system
// items of `item`, M9 the Market items of `item`, M11 `actividad` and the last two
// index pages of `pagina` — and why each group is still read through the menu or
// the route inventory (`esRutaDelSitio`, see `paginaEntries`): a page the build does not
// write, or a record a build with OCULTAR_BORRADORES=1 hides, has no entry.

import type { APIRoute } from 'astro';

import { esRutaDelSitio } from '../../../../scripts/lib/rutas-migradas.mjs';

import { ITEMS_PAGE_SIZE } from '@/components/items/config';
import { getLocale, locales, type Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { fill } from '@/i18n/messages/types';
import type { Quest } from '@/lib/content/content-schema';
import { formatTier } from '@/lib/content/format';
import { resolvePokemonImage } from '@/lib/content/pokemon-media';
import {
  getCategorias,
  getElementos,
  getItems,
  getSistema,
  getSpriteRegistry,
} from '@/lib/content/registry';
import { getPokemon, getQuests, getSystemItemHref, getSystemItems } from '@/lib/content/repository';
import type { PokemonRecord } from '@/lib/content/types';
import { formatInteger } from '@/lib/format/numbers';
import { buildNav } from '@/lib/nav/groups';
import { normalize } from '@/lib/search/normalize';
import type { SearchEntry, SearchIcon } from '@/lib/search/rank';
import { spriteOrNull } from '@/lib/sprites/resolve';

export const prerender = true;

export function getStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}

const dictionaries: Record<Locale, Messages> = { es, en };

/** Drawn size of an illustration in the 32 px icon cell of the palette (spec 7.9.3). */
const ART_SIZE = 24;

/**
 * A sprite key of the registry as the 32 px icon cell of the palette takes it (spec
 * 7.9.3, DS:Sprite): a pixel sprite at 1x centred in the game cell, or an illustration
 * drawn smooth at 24 like the Pokémon art. `null` (the record has no sprite yet, D-011)
 * leaves the cell empty.
 */
function spriteIcon(key: string | null | undefined): SearchIcon | null {
  const sprite = spriteOrNull(getSpriteRegistry(), key);
  if (sprite === null) return null;
  const icon: SearchIcon = { src: sprite.src, size: sprite.size, frames: sprite.frames };
  if (sprite.frame !== undefined) icon.frame = sprite.frame;
  if (sprite.smooth) {
    icon.smooth = true;
    icon.width = ART_SIZE;
    icon.height = ART_SIZE;
  } else {
    icon.cell = true;
  }
  return icon;
}

/** Joins the parts of a Pokémon's `meta`, as the cards write «Nº 6 · Generación 1». */
const META_JOINER = ' · ';

/**
 * «Nivel {n} · {tier}» (spec 8.6), with only the parts that have a value: the
 * level is the Requisito value of spec 8.0.5 («Nivel 80» / «Level 80», the
 * `ui.tooltip.level` template the sheet and the cards write it with) and the
 * tier is `formatTier` («T3», «Legendary»). A record with neither has no `meta`:
 * the option shows its name alone, never «—» (8.0.5).
 */
function pokemonMeta(record: PokemonRecord, locale: Locale): string | undefined {
  const parts: string[] = [];
  if (record.nivel !== null) {
    parts.push(
      fill(dictionaries[locale].ui.tooltip.level, { n: formatInteger(record.nivel, locale) }),
    );
  }
  if (record.tier !== null) parts.push(formatTier(record.tier));
  return parts.length > 0 ? parts.join(META_JOINER) : undefined;
}

/**
 * The element names of `content/elementos.json` in the language of the index,
 * by id (spec 8.0.5). An element the registry does not name is searched by its
 * id alone: nothing here invents a label (R7, X4).
 */
function elementNames(locale: Locale): Map<string, string> {
  return new Map(getElementos().map((element) => [element.id, element.nombre[locale]]));
}

/**
 * Pokémon: one entry per record of `content/pokemon.json`, with its page as
 * `href` (spec 8.3), its art as icon and «Nivel {n} · {tier}» as `meta`.
 *
 * Searchable text of spec 8.6 besides the name: the `id` and the Pokédex number
 * travel in their own fields (`dex` answers «6», «006», «#6» and «nº 6»), the
 * tier travels in `meta` («t3», «legendary»), and `terms` carries the id and
 * the name of each element in the language of the index (`fire`, «fuego»),
 * normalised, and `shiny` on the Shiny variants.
 */
function pokemonEntries(locale: Locale): SearchEntry[] {
  const names = elementNames(locale);
  return getPokemon().map((record) => {
    const art = resolvePokemonImage(record.imagen);
    const terms = new Set<string>();
    for (const element of record.elementos) {
      terms.add(normalize(element));
      const name = names.get(element);
      if (name !== undefined && name !== '') terms.add(normalize(name));
    }
    if (record.variante === 'shiny') terms.add('shiny');

    const entry: SearchEntry = {
      kind: 'pokemon',
      id: record.id,
      name: record.nombre,
      href: `/${locale}/pokedex/${record.id}/`,
      icon: art ? { src: art, smooth: true, width: ART_SIZE, height: ART_SIZE } : null,
    };
    const meta = pokemonMeta(record, locale);
    if (meta !== undefined) entry.meta = meta;
    if (record.numero !== null) entry.dex = record.numero;
    if (terms.size > 0) entry.terms = [...terms];
    return entry;
  });
}

/**
 * Systems: one entry per system page (spec 8.4), which is one entry of the
 * «Sistemas» group of the menu. The entries are that group's links, name and
 * route included, so the index and the menu carry the same systems in the same
 * order and a draft OCULTAR_BORRADORES=1 hides is in neither (SI4, BU6). `meta`
 * is the record's subtitle in the language of the index when it has one, which
 * is also the searchable text spec 8.6 adds for a system; the icon is its sprite.
 * No `terms`: the name and the subtitle are all the table searches.
 */
function sistemaEntries(locale: Locale): SearchEntry[] {
  const links = buildNav(locale, '').groups.find((group) => group.id === 'sistemas')?.items ?? [];
  return links.flatMap((link) => {
    const sistema = getSistema(link.id);
    if (sistema === undefined) return [];
    const entry: SearchEntry = {
      kind: 'sistema',
      id: sistema.id,
      name: link.label,
      href: link.href,
      icon: spriteIcon(sistema.sprite),
    };
    const subtitle = sistema.subtitulo?.[locale];
    if (subtitle !== undefined) entry.meta = subtitle;
    return [entry];
  });
}

/**
 * The href of each category page of the «Ítems» group of the menu, by category id (8.0.3,
 * 8.5). WG5 trims that group, so a category the build has no page for is not in this map
 * and its items have no entry (BU6). «Todo» is in it too, with `/{l}/items/`; an item is
 * never sent there, because the search index points at the page of its own category.
 */
function categoryHrefs(locale: Locale): Map<string, string> {
  const links = buildNav(locale, '').groups.find((group) => group.id === 'items')?.items ?? [];
  return new Map(links.map((link) => [link.id, link.href]));
}

/**
 * Items, the half M9 writes (8.5): each item of `getItems()`, in the Market order of
 * `content/items/categorias.json` and, inside a category, in the order of its file — the
 * order the pages and `/{l}/items/datos.json` write the rows in, so `p` is the page of the
 * category list the item is on (24 a page, `ITEMS_PAGE_SIZE`) and `#item-{id}` is its anchor
 * in the three views (H7). The first page carries no `page` (8.6). `meta` is the name of its
 * category in the language of the index, which is also the text 8.6 adds to its name as
 * searchable, and the icon is its sprite. A draft this build hides is not in `getItems()` and
 * has no entry (IT2, SI4); an item whose category page this build has no route for has none
 * either (BU6).
 */
function marketItemEntries(locale: Locale): SearchEntry[] {
  const hrefs = categoryHrefs(locale);
  const names = new Map(getCategorias().map((category) => [category.id, category.nombre[locale]]));
  const seen = new Map<string, number>();
  return getItems().flatMap((item) => {
    const href = hrefs.get(item.categoria);
    if (href === undefined) return [];
    const index = seen.get(item.categoria) ?? 0;
    seen.set(item.categoria, index + 1);
    const page = Math.floor(index / ITEMS_PAGE_SIZE) + 1;
    const query = page > 1 ? `?page=${page}` : '';
    const category = names.get(item.categoria);
    const entry: SearchEntry = {
      kind: 'item',
      id: item.id,
      name: item.nombre,
      href: `${href}${query}#item-${item.id}`,
      icon: spriteIcon(item.sprite),
    };
    if (category !== undefined && category !== '') {
      entry.meta = category;
      entry.terms = [normalize(category)];
    }
    return [entry];
  });
}

/**
 * Items, the half M8 writes (E16): each item of `content/system-items.json` whose
 * system page exists in this build, pointing at its entry in the «Ítems» section
 * of that page (`/{l}/sistemas/{sistema}/#item-{id}`, H7, spec 8.4.2 step 6).
 * `meta` is the title of its system, the text spec 8.6 gives an item of a system
 * and the one it is searched by besides its name; the icon is its sprite. An item
 * with no `sistema`, or whose system is a draft this build hides, has no page and
 * no entry (`getSystemItemHref` answers `null`, SI4). The Market items of
 * `getItems()` join with their category pages in M9.
 */
function systemItemEntries(locale: Locale): SearchEntry[] {
  return getSystemItems().flatMap((item) => {
    const href = getSystemItemHref(item, locale);
    const sistema = item.sistema === null ? undefined : getSistema(item.sistema);
    if (href === null || sistema === undefined) return [];
    return [
      {
        kind: 'item' as const,
        id: item.id,
        name: item.nombre,
        href,
        icon: spriteIcon(item.sprite),
        meta: sistema.titulo[locale],
      },
    ];
  });
}

/**
 * Activities: one entry per activity published (spec 8.9), which is one entry of the
 * «Actividades» group of the menu, name and route included, so the index and the menu
 * carry the same activities in the same order and an activity whose page the build does
 * not write is in neither (BU6, WG5). Its name is `nombre`, the name of the game (T23);
 * `meta` is «Nivel {n}» (spec 8.6), the Requisito value of 8.0.5 written with the
 * `ui.tooltip.level` template the banner of its page uses, and only with a
 * `nivelRequerido`: without one the option shows the name alone, never «—» (8.0.5). The
 * icon is its sprite (3.13), or the empty cell while the record has none (D-011). No
 * `terms`: spec 8.6 adds no searchable text to an activity besides its name.
 */
function actividadEntries(locale: Locale): SearchEntry[] {
  const links =
    buildNav(locale, '').groups.find((group) => group.id === 'actividades')?.items ?? [];
  // What an entry reads of an activity (3.13).
  const quests = new Map<string, Pick<Quest, 'id' | 'nivelRequerido' | 'sprite'>>(
    getQuests().map((quest) => [quest.id, quest]),
  );
  return links.flatMap((link) => {
    const quest = quests.get(link.id);
    if (quest === undefined) return [];
    const entry: SearchEntry = {
      kind: 'actividad',
      id: quest.id,
      name: link.label,
      href: link.href,
      icon: spriteIcon(quest.sprite),
    };
    if (quest.nivelRequerido !== null) {
      entry.meta = fill(dictionaries[locale].ui.tooltip.level, {
        n: formatInteger(quest.nivelRequerido, locale),
      });
    }
    return [entry];
  });
}

/**
 * The pages of the `pagina` group of spec 8.6, in the order of its table:
 * Pokédex, Tier list, Comparar Pokémon, Ítems, Sistemas, Actividades,
 * Herramientas, Guild, Comercio and Cambios. «Inicio» is not in that table and
 * «Mapa» is explicitly out of it (it is a marker, spec 8.11).
 *
 * Six of them are entries of the menu. The other four — Ítems, Sistemas,
 * Actividades and Herramientas — are the index pages of their menu groups
 * (template D), not entries of it: `INDEX_PAGES` names them. Each joined the
 * index with the milestone that built it (M8 Sistemas, M9 Ítems, M11
 * Actividades and Herramientas), so from M11 on the group is the whole table.
 */
const PAGE_ORDER = [
  'pokedex',
  'tiers',
  'comparar',
  'items',
  'sistemas',
  'actividades',
  'herramientas',
  'guild',
  'comercio',
  'cambios',
] as const;

type PageId = (typeof PAGE_ORDER)[number];

const PAGE_IDS: ReadonlySet<string> = new Set(PAGE_ORDER);

/** The menu groups whose entries are pages of the `pagina` group (spec 8.0.3). */
const PAGE_GROUPS = new Set(['pokemon', 'herramientas', 'comunidad']);

/**
 * The index pages of the `pagina` group, with their route template of spec 8.0.1
 * and the h1 of the page as their name: the systems index (spec 8.4.1) is
 * «Sistemas» / «Systems», `systems.title`, the same string as its crumb; «Todo»
 * of Ítems (spec 8.5) is the label of its menu group, which is what that page
 * writes as its h1 and its single crumb; the activities index (spec 8.9.1) is
 * `activities.title` and the tools index (spec 8.10) `tools.title`, each the h1
 * and the single crumb of its page. A page whose name cannot be read — the
 * menu has no such group, because the build has no such route — has no entry,
 * like the route filter below (WG5, BU6).
 */
const INDEX_PAGES: { id: PageId; route: string; name: (locale: Locale) => string | undefined }[] = [
  { id: 'sistemas', route: '/{l}/sistemas/', name: (locale) => dictionaries[locale].systems.title },
  { id: 'items', route: '/{l}/items/', name: (locale) => groupLabel(locale, 'items') },
  {
    id: 'actividades',
    route: '/{l}/actividades/',
    name: (locale) => dictionaries[locale].activities.title,
  },
  {
    id: 'herramientas',
    route: '/{l}/herramientas/',
    name: (locale) => dictionaries[locale].tools.title,
  },
];

/** The label of a menu group (spec 8.0.3), or nothing when the group has no link (WG5). */
function groupLabel(locale: Locale, id: string): string | undefined {
  return buildNav(locale, '').groups.find((group) => group.id === id)?.label;
}

/**
 * Pages: the menu entries take their name and route from `src/lib/nav/groups.ts`,
 * the module that owns the labels of the fixed menu entries (spec 8.0.3), so the
 * index and the menu can never disagree; the index pages take theirs from
 * `INDEX_PAGES`. WG5 trims both the same way: a page is in the index only while
 * the build carries its route (BU6). No icon and no `meta`, which is what the
 * table of spec 8.6 gives this group.
 *
 * Pokédex is the first of them, `/{l}/pokedex/` since M6 and its Pokémon pages
 * since M7, Sistemas since M8, «Tier list» and Ítems since M9, Comparar
 * Pokémon, Actividades, Herramientas and Cambios since M11, and Comercio and
 * Guild, rewritten by M12 and M13 (scripts/lib/rutas-migradas.mjs).
 *
 * Only the groups of fixed entries are read: an entry of a group filled from a
 * registry (a system, a Market category) is never a page of this group, whatever
 * its id, and neither is an entry of the pinned «Destacados» group (M10), which
 * repeats pages the other groups already link — read here, `/{l}/pokedex/` would
 * be in the index twice.
 *
 * The path passed to `buildNav` matches no route on purpose: `aria-current` is a
 * property of a rendered menu and has no meaning in the index.
 */
function paginaEntries(locale: Locale): SearchEntry[] {
  const menu = buildNav(locale, '')
    .groups.filter((group) => PAGE_GROUPS.has(group.id))
    .flatMap((group) => group.items)
    .filter((link) => PAGE_IDS.has(link.id))
    .map((link) => ({ id: link.id, name: link.label, href: link.href }));
  const indexes = INDEX_PAGES.flatMap((page) => {
    const name = page.name(locale);
    const href = page.route.replaceAll('{l}', locale);
    return name === undefined || !esRutaDelSitio(href) ? [] : [{ id: page.id, name, href }];
  });
  const rank = (id: string) => PAGE_ORDER.indexOf(id as PageId);
  return [...menu, ...indexes]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map((page) => ({ kind: 'pagina' as const, ...page, icon: null }));
}

/**
 * The index of one locale: the five groups of spec 8.6, each with the entries whose
 * routes the build carries (BU6), in the order of `searchKinds`. M8 added `sistema`
 * and the system items of `item`, M9 the Market items and M11 `actividad`, and each
 * of those milestones widened `pagina` with the index page it built. Inside `item`
 * the Market items come first and the system items after, the order of the table of
 * spec 8.6.
 */
export function buildSearchIndex(locale: Locale): SearchEntry[] {
  return [
    ...pokemonEntries(locale),
    ...sistemaEntries(locale),
    ...marketItemEntries(locale),
    ...systemItemEntries(locale),
    ...actividadEntries(locale),
    ...paginaEntries(locale),
  ];
}

export const GET: APIRoute = ({ params }) => {
  const locale = getLocale(params.locale);
  return new Response(JSON.stringify(buildSearchIndex(locale)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
