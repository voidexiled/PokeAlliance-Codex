// Menu data of the sidebar and the phone sheet (spec 8.0.3, 7.10.2, DS:Sidebar).
//
// This module owns the labels of the fixed entries. They are not in the
// dictionaries: 13.2 lists the namespaces of the site and none of them holds
// navigation labels, and the milestone that fills `shell` (M3) only carries the
// table of 13.2. The entries of the Destacados, Sistemas, Ítems and Actividades
// groups never come from here at all: they come from their registries (8.0.3),
// with the milestone that builds those pages; only the group labels are here.
//
// WG5 (8.0.3, 8.0.7, PZ-04): a link exists only if its route exists in the
// build, and a group with no links is not rendered. `esRutaDelSitio` of
// scripts/lib/rutas-migradas.mjs answers "does this route exist" from the route
// inventory of 8.0.1 (`plantillasDelSitio`), with the ids the registries give each
// parameter. Since M13 every entry of 8.0.3 has its route there; since M15 the
// gates measure every page (`'*'`), which says nothing about whether one exists.
//
// The milestones that add links are written down in the spec: M8 fills the
// Sistemas group from `content/sistemas/`; M9 adds «Tier list» (its entry was
// already declared, and M9 builds its route) and fills the Ítems group from
// `content/items/categorias.json`; M10 fills the pinned «Destacados» group from
// `content/destacados.json`, with its sprites; M11 fills the Actividades group from
// `content/quests.json` and builds the pages of «Comparar Pokémon», «Mapa» and
// «Cambios», so from M11 on every entry of 8.0.3 has its route. A group whose
// registry has no record still has no items and no markup.
//
// A group filled from a registry declares a reader instead of a list of entries
// (`registro`): it runs on every call, so a build with OCULTAR_BORRADORES=1 reads
// the records that build keeps, and each entry it returns goes through the same
// WG5 test as a fixed one.
//
// Sprites (owner rule 2026-09-25, replacing «only Destacados carries sprites» of 7.10.2):
// every link and every group heading draws a game sprite in the 16 px box of sidebar.css.
// An entry filled from a registry takes the sprite of its record (`sprite` of a system,
// `icono` of a category, `sprite` of an activity, `sprite` of a Destacados entry); a fixed
// page linked by «Destacados» takes the sprite of that record, so one page has one sprite
// in the whole menu; the other fixed entries and the group headings name their key in
// `ICONOS`. A key the registry does not hold fails the build (7.4.1); `null` keeps the box
// empty, so every label of a list starts at the same x.
import { esRutaDelSitio, normalizarRuta } from '../../../scripts/lib/rutas-migradas.mjs';

import type { Locale } from '@/i18n/config';
import {
  getCategorias,
  getDestacados,
  getSistemas,
  getSpriteRegistry,
} from '@/lib/content/registry';
import { getQuests } from '@/lib/content/repository';
import { menuSpriteSize } from '@/lib/nav/menu-sprites';
import { spriteOrNull, type SpriteData } from '@/lib/sprites/resolve';

/**
 * The sprite of a menu entry, as the props of `Sprite` take it (7.4.1, DP2): what the adapter
 * returns for its key, plus its drawn size when the menu scales it (`spriteDeMenu`). Without
 * `width` the sprite is drawn at 1x.
 */
export type SidebarSprite = SpriteData & { width?: number; height?: number };

/** A rendered link of the menu. */
export interface SidebarLink {
  /** Stable id, unique inside its group; `Sidebar.astro` builds element ids with it. */
  id: string;
  label: string;
  href: string;
  /**
   * `page` on the route itself; `true` on a child route with no entry of its own
   * (a Pokémon page under Pokédex, a listing under Comercio), which marks the
   * entry of its section with the same look (E10). At most one link of the whole
   * menu carries it.
   */
  current?: 'page' | 'true';
  /**
   * The sprite of the entry in its box of 16 (owner rule 2026-09-25, DS:Sidebar). `null` while
   * the entry has no sprite yet (D-011): the box stays, empty, so the labels of the list start
   * at the same x. The links of «Destacados» bounce; the others rest.
   *
   * The sprite is centred in the box and turns when its sheet is an animation (owner rule
   * 2026-09-25: what the client animates, the site animates everywhere); `spriteDeMenu` picks
   * its drawn size.
   */
  sprite: SidebarSprite | null;
}

/** A rendered group of the menu. */
export interface SidebarGroup {
  id: string;
  label: string;
  /** The sprite of the heading, in the same box of 16 as the links (owner rule 2026-09-25). */
  sprite: SidebarSprite | null;
  /** The fixed «Destacados» group: a heading with no button and no chevron (7.10.2). */
  pinned: boolean;
  /** `<details open>`: a group starts open when it holds the current page (7.10.2). */
  open: boolean;
  items: SidebarLink[];
}

/** What `Sidebar.astro` and `MobileMenu.astro` paint. */
export interface SidebarNav {
  /** Links above the groups: «Inicio». */
  top: SidebarLink[];
  groups: SidebarGroup[];
}

/** A label in both locales (8.0.3). A game term or a proper name reads the same in both. */
type Etiqueta = Record<Locale, string>;

interface EntradaDeclarada {
  id: string;
  label: Etiqueta;
  /** Route template of 8.0.1; `{l}` is the locale segment. */
  href: string;
  /**
   * The routes under `href` belong to this entry: with no entry of their own they
   * mark it `aria-current="true"` (E10).
   */
  seccion?: boolean;
  /**
   * The key of its sprite in public/sprites/sprites.json, or `null` for the empty box. A fixed
   * entry leaves it out: `ICONOS` names it, or the «Destacados» record of its page.
   */
  icono?: string | null;
}

interface GrupoDeclarado {
  id: string;
  label: Etiqueta;
  pinned?: boolean;
  items: EntradaDeclarada[];
  /** The entries of a group filled from a registry, read on each call and after `items`. */
  registro?: () => EntradaDeclarada[];
}

/** The fixed key of the Diamond (3.13). */
const DIAMOND = 'ui/diamond';

/**
 * The sprites of the fixed entries and of the group headings, by id (owner rule 2026-09-25):
 * keys of public/sprites/sprites.json, chosen from the client's own art (Pokédex, gold medal
 * and Poké Lens items, its top-bar buttons for Pokémon, Quest Log, Analyzer and VIP list). A
 * group heading is `grupo:{id}`. A fixed page that «Destacados» links takes the sprite of that
 * record instead of this table.
 */
const ICONOS: Readonly<Record<string, string | null>> = {
  inicio: 'ui/inicio',
  pokedex: 'ui/nav/pokedex',
  tiers: 'ui/nav/tier-list',
  comparar: 'ui/nav/comparar',
  guild: 'ui/herramientas/guild',
  mapa: 'ui/herramientas/mapa',
  comercio: DIAMOND,
  cambios: 'ui/cambios',
  'grupo:destacados': 'ui/nav/destacados',
  'grupo:pokemon': 'ui/nav/pokemon',
  'grupo:sistemas': 'ui/indice/sistemas',
  'grupo:items': 'ui/indice/items',
  'grupo:actividades': 'ui/nav/actividades',
  'grupo:herramientas': 'ui/nav/herramientas',
  'grupo:comunidad': 'ui/nav/comunidad',
};

/**
 * The sprite of a menu entry (DS:Sidebar): its key through the adapter, with no option, so an
 * animated sheet turns in the menu as everywhere, and the size `menuSpriteSize` gives it: 1x for art
 * up to 20, scaled down to 18 for larger art (src/lib/nav/menu-sprites.ts). `SidebarSprite.astro`
 * centres it in the box. An unknown key fails the build here, as it does in every other
 * composer (7.4.1).
 */
function spriteDeMenu(key: string | null): SidebarSprite | null {
  const sprite = spriteOrNull(getSpriteRegistry(), key);
  if (key === null || sprite === null) return null;
  const drawn = menuSpriteSize(key, sprite.size, sprite.smooth === true);
  return drawn === null ? sprite : { ...sprite, ...drawn };
}

/**
 * `/pokedex/tiers/` -> `pokedex-tiers`, `/` -> `inicio`: the id of a «Destacados» entry, which
 * has none in its record. Two entries never share a route (`pnpm content:check`, G10), so the
 * id is unique inside the group.
 */
function idDeRuta(ruta: string): string {
  const segmentos = ruta.split('/').filter((segmento) => segmento.length > 0);
  return segmentos.length > 0 ? segmentos.join('-') : 'inicio';
}

/**
 * «Destacados» (8.0.3, 8.1 step 3, 7.10.2): the entries of `content/destacados.json`, in the
 * order of the file, labelled with their `etiqueta` in each locale, each with its sprite of 16.
 * They are the same entries as the `FeaturedSection` of the Inicio, of Buscar and of the 404,
 * which `buildFeatured` reads from the same records through the same WG5 test (`existeRuta`).
 * `getDestacados` drops the drafts of a build with OCULTAR_BORRADORES=1, and without the file
 * the list is empty: the group has no link and is not rendered (WG5, 8.1 «Estados»). Every
 * `ruta` is a page the build writes (`pnpm content:check`, §3.13), and the WG5 test of
 * `buildNav` still asks, as it does for every other entry.
 *
 * No entry is a section (E10): a route under a pinned page marks the entry of its own group.
 */
function entradasDeDestacados(): EntradaDeclarada[] {
  return getDestacados().map((destacado) => ({
    id: idDeRuta(destacado.ruta),
    label: destacado.etiqueta,
    href: `/{l}${destacado.ruta}`,
    icono: destacado.sprite,
  }));
}

/**
 * «Sistemas» (8.0.3, 8.4): one entry per system page of `content/sistemas/`, in the order
 * of the registry (`orden`), labelled with its `titulo` in each locale, with the `sprite` of
 * its record. `getSistemas` is also what writes the pages
 * (`getStaticPaths` of `src/pages/[locale]/sistemas/[id].astro`), so a draft that
 * OCULTAR_BORRADORES=1 hides has no page and no entry (SI4). With no system, the group has no
 * link and is not rendered (WG5, 8.4 risk 2).
 */
function entradasDeSistemas(): EntradaDeclarada[] {
  return getSistemas().map((sistema) => ({
    id: sistema.id,
    label: sistema.titulo,
    href: `/{l}/sistemas/${sistema.id}/`,
    icono: sistema.sprite,
  }));
}

/**
 * «Ítems» (8.0.3, 8.5): one entry per category of `content/items/categorias.json`, in the
 * order of the registry (`orden`), labelled with its `nombre` in each locale, with the `icono`
 * of its record (the icon of its tab in the client). «Todo», the virtual category, comes
 * first and is `/{l}/items/`; each of the other 13 is `/{l}/items/c/{id}/`, the page
 * `getStaticPaths` of `src/pages/[locale]/items/c/[categoria].astro` writes. The schema
 * fixes the 14 categories and their order, and no category is a draft, so the group is the
 * same in every build; a category with no item still has its page and its link, with the
 * `EmptyState` of 8.5 (IT2). With no route in the build the group has no link and is not
 * rendered (WG5).
 */
function entradasDeItems(): EntradaDeclarada[] {
  return getCategorias().map((categoria) => ({
    id: categoria.id,
    label: categoria.nombre,
    href: categoria.virtual === true ? '/{l}/items/' : `/{l}/items/c/${categoria.id}/`,
    icono: categoria.icono,
  }));
}

/**
 * «Actividades» (8.0.3, 8.9): one entry per activity of `content/quests.json`, in the order of
 * the file, to its page `/{l}/actividades/{id}/` (8.9.2), with the `sprite` of its record.
 * The label is `nombre`, the name the game gives the
 * activity, the same in both locales (T23, 13.4). An activity has no `borrador` field
 * (content/schemas/quests.schema.json), so every record of the file is published and has its
 * page (`getStaticPaths` of `src/pages/[locale]/actividades/[id].astro`), which the WG5 test of
 * `buildNav` still asks about, as for every other entry. The index `/{l}/actividades/` is the
 * page of the group (8.9.1), not an entry of it (8.0.3), as `/{l}/sistemas/` is for «Sistemas».
 * With no activity the group has no link and is not rendered (WG5).
 */
function entradasDeActividades(): EntradaDeclarada[] {
  return getQuests().map((actividad) => ({
    id: actividad.id,
    label: { es: actividad.nombre, en: actividad.nombre },
    href: `/{l}/actividades/${actividad.id}/`,
    icono: actividad.sprite,
  }));
}

/** Links above the groups (8.0.3). */
const ARRIBA: EntradaDeclarada[] = [
  { id: 'inicio', label: { es: 'Inicio', en: 'Home' }, href: '/{l}/' },
];

/**
 * The groups of 8.0.3, in its order. «Aportar al mapa» is not here (A1, X1), and
 * the theme entry of the boards is not a menu entry at all.
 */
const GRUPOS: GrupoDeclarado[] = [
  // From `content/destacados.json`, with the sprites of its records (M10, 7.10.2).
  {
    id: 'destacados',
    label: { es: 'Destacados', en: 'Featured' },
    pinned: true,
    items: [],
    registro: entradasDeDestacados,
  },
  {
    id: 'pokemon',
    label: { es: 'Pokémon', en: 'Pokémon' },
    items: [
      // A Pokémon page (`/{l}/pokedex/{id}/`) has no entry of its own: it marks this one.
      {
        id: 'pokedex',
        label: { es: 'Pokédex', en: 'Pokédex' },
        href: '/{l}/pokedex/',
        seccion: true,
      },
      // «Tier list» is a game term and reads the same in both locales (T23). M9 builds its route.
      { id: 'tiers', label: { es: 'Tier list', en: 'Tier list' }, href: '/{l}/pokedex/tiers/' },
      {
        id: 'comparar',
        label: { es: 'Comparar Pokémon', en: 'Compare Pokémon' },
        href: '/{l}/herramientas/pokemon/',
      },
    ],
  },
  // From `content/sistemas/`, in the order of the registry (M8).
  {
    id: 'sistemas',
    label: { es: 'Sistemas', en: 'Systems' },
    items: [],
    registro: entradasDeSistemas,
  },
  // From `content/items/categorias.json`, with «Todo» first (M9).
  {
    id: 'items',
    label: { es: 'Ítems', en: 'Items' },
    items: [],
    registro: entradasDeItems,
  },
  // From `content/quests.json`, in the order of the file (M11).
  {
    id: 'actividades',
    label: { es: 'Actividades', en: 'Activities' },
    items: [],
    registro: entradasDeActividades,
  },
  {
    id: 'herramientas',
    label: { es: 'Herramientas', en: 'Tools' },
    items: [
      // «Guild» is the name the game gives it and reads the same in both locales (T23).
      { id: 'guild', label: { es: 'Guild', en: 'Guild' }, href: '/{l}/herramientas/guild/' },
      { id: 'mapa', label: { es: 'Mapa', en: 'Map' }, href: '/{l}/mapa/' },
    ],
  },
  {
    id: 'comunidad',
    label: { es: 'Comunidad', en: 'Community' },
    items: [
      // The detail, the seller profile and the publish page of Comercio hang from this one.
      {
        id: 'comercio',
        label: { es: 'Comercio', en: 'Trade' },
        href: '/{l}/comercio/',
        seccion: true,
      },
      { id: 'cambios', label: { es: 'Cambios', en: 'Changes' }, href: '/{l}/cambios/' },
    ],
  },
];

/** The sprite of a key, as the menu draws it. */
function conSprite(key: string | null): { sprite: SidebarSprite | null } {
  return { sprite: spriteDeMenu(key) };
}

/** `/{l}/pokedex/` -> `/es/pokedex/`. */
function conIdioma(plantilla: string, locale: Locale): string {
  return plantilla.replaceAll('{l}', locale);
}

/** WG5: whether the build carries this route, so the menu may link it. */
function existeRuta(plantilla: string, locale: Locale): boolean {
  return esRutaDelSitio(conIdioma(plantilla, locale));
}

/**
 * WG5 for a «Destacados» entry: whether the menu, and so the Destacados of the pages
 * (`buildFeatured`), link the page of its `ruta` (a route of content/destacados.json,
 * without the locale). Every page `pnpm content:check` accepts there is one of them.
 */
export function enlazaDestacado(ruta: string, locale: Locale): boolean {
  return existeRuta(`/{l}${ruta}`, locale);
}

/** An entry that the build can link, with its route resolved for this locale. */
interface EntradaViva extends EntradaDeclarada {
  ruta: string;
  grupo: string;
  /** The entry belongs to the pinned «Destacados» group. */
  fijada: boolean;
}

/**
 * The entry the current page marks (E10). The exact route wins; with no exact
 * match, the section whose route is the longest prefix of the current path does,
 * so a page under Pokédex or under Comercio marks its section and nothing else.
 * Buscar, 404 and Cuenta hang from no section and mark nothing.
 *
 * «Destacados» repeats pages that another group already links (`/pokedex/` is also
 * «Pokémon › Pokédex»), and a single link of the menu carries the mark: the entry of
 * the page's own group wins, and its group opens, as Lienzo:Pokedex marks «Pokémon ›
 * Pokédex» under a pinned «Pokédex». A pinned entry is marked only when no other group
 * links its route.
 */
function entradaActual(entradas: EntradaViva[], currentPath: string): EntradaViva | null {
  const actual = normalizarRuta(currentPath);
  const exactas = entradas.filter((entrada) => entrada.ruta === actual);
  const exacta = exactas.find((entrada) => !entrada.fijada) ?? exactas[0];
  if (exacta) return exacta;

  let mejor: EntradaViva | null = null;
  for (const entrada of entradas) {
    if (!entrada.seccion || !actual.startsWith(entrada.ruta)) continue;
    if (!mejor || entrada.ruta.length > mejor.ruta.length) mejor = entrada;
  }
  return mejor;
}

/**
 * The menu of 8.0.3 for a page: the links whose route the build carries, the
 * groups that have at least one, and the single `aria-current` of the page.
 *
 * @param locale Locale of the page: picks the labels and the locale segment.
 * @param currentPath Path of the page, as `Astro.url.pathname` gives it.
 */
export function buildNav(locale: Locale, currentPath: string): SidebarNav {
  const vivas: EntradaViva[] = [];
  const recoger = (entradas: EntradaDeclarada[], grupo: string, fijada: boolean) => {
    for (const entrada of entradas) {
      if (!existeRuta(entrada.href, locale)) continue;
      vivas.push({
        ...entrada,
        grupo,
        fijada,
        ruta: normalizarRuta(conIdioma(entrada.href, locale)),
      });
    }
  };

  recoger(ARRIBA, '', false);
  for (const grupo of GRUPOS) {
    const fijada = grupo.pinned === true;
    recoger(grupo.items, grupo.id, fijada);
    if (grupo.registro) recoger(grupo.registro(), grupo.id, fijada);
  }

  const actual = entradaActual(vivas, currentPath);
  // One page, one sprite: a fixed entry whose page «Destacados» links takes that record's.
  const destacadas = new Map(
    vivas.filter((entrada) => entrada.fijada).map((entrada) => [entrada.ruta, entrada.icono]),
  );
  const enlace = (entrada: EntradaViva): SidebarLink => {
    const key =
      entrada.icono !== undefined
        ? entrada.icono
        : (destacadas.get(entrada.ruta) ?? ICONOS[entrada.id] ?? null);
    return {
      id: entrada.id,
      label: entrada.label[locale],
      href: entrada.ruta,
      ...(entrada === actual
        ? { current: entrada.ruta === normalizarRuta(currentPath) ? 'page' : 'true' }
        : {}),
      ...conSprite(key),
    };
  };

  const deGrupo = (id: string) => vivas.filter((entrada) => entrada.grupo === id);

  return {
    top: deGrupo('').map(enlace),
    groups: GRUPOS.map((grupo) => {
      const items = deGrupo(grupo.id);
      return {
        id: grupo.id,
        label: grupo.label[locale],
        ...conSprite(ICONOS[`grupo:${grupo.id}`] ?? null),
        pinned: grupo.pinned === true,
        open: actual !== null && actual.grupo === grupo.id,
        items: items.map(enlace),
      };
    }).filter((grupo) => grupo.items.length > 0),
  };
}

/** A «Destacados» entry as the `FeaturedSection` of a page draws it (8.1 step 3). */
export interface FeaturedLink {
  /** `etiqueta` of the record, in the page's locale. */
  label: string;
  /** The route of the record with its locale segment, as the pinned group links it. */
  href: string;
  /** The sprite as the adapter resolves it (DP2); `null` leaves the box empty. */
  sprite: SpriteData | null;
}

/**
 * «Destacados» of the Inicio, of Buscar and of the 404 (8.1 step 3, 8.6 steps 3 and 6, 8.12):
 * the entries of the pinned group of the menu — the same records of content/destacados.json,
 * in the order of the file, through the same WG5 test (`enlazaDestacado`) — so a page and its menu
 * never show different ones (8.1 step 3: «Las mismas entradas forman el grupo "Destacados" del
 * menú»). A sheet in `animacion` mode turns here as in the menu; `FeaturedCard` picks its
 * scale.
 *
 * @param locale Locale of the page: picks the labels and the locale segment.
 */
export function buildFeatured(locale: Locale): FeaturedLink[] {
  const registry = getSpriteRegistry();
  return getDestacados().flatMap((destacado) => {
    if (!enlazaDestacado(destacado.ruta, locale)) return [];
    const sprite = spriteOrNull(registry, destacado.sprite);
    return [
      {
        label: destacado.etiqueta[locale],
        href: normalizarRuta(conIdioma(`/{l}${destacado.ruta}`, locale)),
        sprite,
      },
    ];
  });
}
