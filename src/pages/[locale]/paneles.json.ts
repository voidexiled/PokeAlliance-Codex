// `/{l}/paneles.json` (owner rule 2026-09-25, every tooltip complete): the part of each game
// tooltip that the lists' data files and props do not carry, one prerendered JSON per locale.
// The shape and who reads it are in src/lib/game/panels.ts; the facts come from
// src/lib/game/item-facts.ts, so an item panel of a list shows what its own page shows.
//
// Budget (13.6): a data file, at most 60 KB gzip and 400 KB uncompressed; `pnpm perf:budget`
// measures it with the lists that load it. A fact the registries do not know is left out, so
// the file only grows with the data.
import type { APIRoute } from 'astro';

import { getLocale, locales, type Locale } from '@/i18n/config';
import { en } from '@/i18n/messages/en';
import { es } from '@/i18n/messages/es';
import { getElementos, getItems } from '@/lib/content/registry';
import { getPokemon } from '@/lib/content/repository';
import { droppersOf, itemTipFacts, namesOrCount } from '@/lib/game/item-facts';
import type { PanelItem, PanelPokemon, PanelsData } from '@/lib/game/panels';
import { effectivenessGroups, encodeEffectiveness } from '@/lib/game/pokemon-panel';
import { addonTipRecords, tipIndex } from '@/lib/game/tip-records';
import { tipExtraLabels } from '@/lib/game/tip-labels';

export const prerender = true;

export function getStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}

const dictionaries = { es, en };

/** The panels file of `locale`. */
export function buildPanelsData(locale: Locale): PanelsData {
  const index = tipIndex(locale);
  const elementos = getElementos();
  const elementName = new Map(elementos.map((element) => [element.id, element.nombre[locale]]));
  const order = elementos.map((element) => element.id);

  const items: Record<string, PanelItem> = {};
  for (const item of getItems()) {
    const facts: PanelItem = itemTipFacts(item, index);
    const droppers = droppersOf(item.id, index).map((record) => record.nombre);
    if (droppers.length > 0) facts.dropDe = namesOrCount(droppers);
    if (Object.keys(facts).length > 0) items[item.id] = facts;
  }

  const pokemon: Record<string, PanelPokemon> = {};
  for (const record of getPokemon()) {
    const moveset = record.elementoMoveset ? elementName.get(record.elementoMoveset) : undefined;
    const extra: PanelPokemon = {
      ...(record.numero === null ? {} : { numero: record.numero }),
      ...(moveset === undefined ? {} : { moveset }),
      ...(record.rapido === true ? { rapido: true } : {}),
      ...(record.pesado === true ? { pesado: true } : {}),
      ...((record.habilidades ?? []).length > 0 ? { habilidades: record.habilidades } : {}),
      ...(index.megaStoneOf.has(record.id) ? { megaStone: index.megaStoneOf.get(record.id) } : {}),
    };
    const efectividad = record.efectividad
      ? encodeEffectiveness(effectivenessGroups(record.efectividad), order)
      : undefined;
    if (efectividad !== undefined) extra.efectividad = efectividad;
    if (Object.keys(extra).length > 0) pokemon[record.id] = extra;
  }

  const addons: Record<string, string> = {};
  for (const [id, addon] of addonTipRecords(locale)) {
    if (addon.pokemon) addons[id] = addon.pokemon;
  }

  return {
    v: 1,
    etiquetas: tipExtraLabels(dictionaries[locale].ui.tooltip),
    items,
    pokemon,
    elementos: Object.fromEntries(index.ballsByElement),
    auras: Object.fromEntries(index.ballsByAura),
    addons,
    tipos: elementos.map((element) => [element.id, element.nombre[locale]] as const),
  };
}

export const GET: APIRoute = ({ params }) => {
  const locale = getLocale(params.locale);
  return new Response(JSON.stringify(buildPanelsData(locale)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
