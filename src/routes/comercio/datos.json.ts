// `/{l}/comercio/datos.json` (spec 9.3, 7.7.5 PR5): the whole public list of Comercio in phase A,
// one prerendered JSON per locale. `/{l}/comercio/` prints the first page of its default state and
// gives its island only those rows; the island asks for this file when it hydrates and its list
// is longer than one page (`dataUrl` of `TradeListRoot`), so a view, a filter or a page that
// needs the other listings has them.
//
// It exists only in a build that reads the sample registry: src/integrations/comercio-fases.ts
// injects it with COMERCIO_DEMO and without COMERCIO_PUBLICO. The listings are data to try every
// branch of the pages, never offers (9.2, D-007, R12), so a production build has neither the
// route nor a single listing id or seller name in its output (CA-9.1, checked by
// scripts/test/build-comercio-fases.mjs and `pnpm seo:check`). Phase B reads the list from
// Supabase and has no such file.
//
// Shape (PR5): the `TradeData` of src/components/trade/TradeListRoot.tsx, `{ "v": 1, "campos",
// "filas", "refs" }`, written by `tradeData` and read back by `decodeTradeData`, the same pair
// the props of the page go through. The rows are the listings the list shows when the build runs
// (9.4: `publicado` or `reservado` whose `expira` is still ahead) in the default order,
// «Recientes» (9.5.5); the island drops the ones that expire afterwards with the visitor's clock.
// Names and data come from the registries, the public label of each channel from the dictionary
// of the locale (9.9); the other labels travel in the props (DP1).
//
// Budget (13.6): at most 60 KB gzip and 400 KB uncompressed; `pnpm perf:budget` measures it with
// `/{l}/comercio/` when the build has it.

import type { APIRoute } from 'astro';

import { getLocale, locales, type Locale } from '@/i18n/config';
import type { Messages } from '@/i18n/messages/en';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import {
  getAuras,
  getCategorias,
  getElementos,
  getItems,
  getMundos,
  getOutfits,
  getSpriteRegistry,
} from '@/lib/content/registry';
import { getPokemon } from '@/lib/content/repository';
import { getAnuncios, getVendedores } from '@/lib/trade/registry';
import { sortListings } from '@/lib/trade/sort';
import { isListed } from '@/lib/trade/types';
import { tradeData, type TradeCatalog, type TradeData } from '@/components/trade/TradeListRoot';

export function getStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}

const dictionaries: Record<Locale, Messages> = { es, en };

/**
 * The registries a Comercio page reads for its rows (`TradeCatalog`), in the language of
 * `locale`: the worlds in their order for that language and the channel labels of its dictionary.
 * The list page composes the same catalogue for its first page.
 */
export function comercioCatalog(locale: Locale): TradeCatalog {
  return {
    pokemon: getPokemon(),
    items: getItems(),
    categorias: getCategorias(),
    elementos: getElementos(),
    auras: getAuras(),
    outfits: getOutfits(),
    mundos: getMundos(locale),
    vendedores: getVendedores(),
    sprites: getSpriteRegistry(),
    channels: dictionaries[locale].trade.channels,
  };
}

/**
 * Every listing the list shows at `now`, sorted by «Recientes», with what its rows name: the file
 * of one locale. Without COMERCIO_DEMO the registry is empty and so is the list.
 */
export function buildComercioData(locale: Locale, now: Date = new Date()): TradeData {
  const listed = sortListings(
    getAnuncios().filter((anuncio) => isListed(anuncio, now)),
    'recientes',
  );
  return tradeData(listed, comercioCatalog(locale), locale);
}

export const GET: APIRoute = ({ params }) => {
  const locale = getLocale(params.locale);
  return new Response(JSON.stringify(buildComercioData(locale)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
