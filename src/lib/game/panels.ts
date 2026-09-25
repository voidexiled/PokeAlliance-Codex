// `/{l}/paneles.json`: what the game tooltips of the list islands show beyond the data their
// lists already carry (owner rule 2026-09-25: every tooltip complete, everywhere). The Items,
// Pokédex, Tier list, search, composer and «Mis anuncios» islands build their panels from
// `datos.json` rows and props that are at their budgets (13.6: props within 20 KB, data files
// within 60 KB gzip), so the rest of each panel travels once, in this file, which every island
// asks for when it is idle after hydrating and the browser keeps for the next page:
//
//   - `etiquetas`: the labels of the rows of `TIP_EXTRA_LABELS` (DP1: the dictionary's);
//   - `items`: each item's `ItemTipFacts` — its game text, held slot and tier, Mega Stone
//     Pokémon, evolutions, elements, Ball facts, Market flag and ways to obtain it — and its
//     «Drop de» in every zone, names or their number past `DROPPER_NAMES_MAX`;
//   - `pokemon`: each Pokémon's number, moveset element, traits, field abilities, its
//     effectiveness and, for a Mega form, its Mega Stone;
//   - `tipos`: the element ids and names the effectiveness codes point at (`efectividad` is
//     «weak|resists|immune», one letter per element: `a` is `tipos[0]`), so the ~1.000 Pokémon
//     cost a few bytes each; src/lib/game/pokemon-panel.ts reads them;
//   - `elementos`, `auras`, `addons`: the Balls of an element, the Balls of an aura and the
//     Pokémon of an addon.
//
// Until it is here (or if it fails) a panel draws the rows its island already had, so the
// prerendered first page and its hydration stay the same. The page never waits for it.
//
// Client-safe: no registry, no Zod. src/pages/[locale]/paneles.json.ts writes the file.
import { useEffect, useState } from 'react';

import type { Locale } from '@/i18n/config';
import type { TipExtraLabels } from '@/lib/game/tip-labels';
import type { ItemTipFacts, PokemonTipRecord } from '@/lib/game/tips';

/** An item's panel facts, with its «Drop de» in every zone. */
export type PanelItem = ItemTipFacts & { dropDe?: readonly string[] | number };

/**
 * A Pokémon's panel facts besides the rows of its list: `moveset` is the element's name and
 * `efectividad` the code of its three effectiveness groups (`encodeEffectiveness` of
 * src/lib/game/pokemon-panel.ts).
 */
export type PanelPokemon = Pick<
  PokemonTipRecord,
  'numero' | 'rapido' | 'pesado' | 'habilidades' | 'megaStone'
> & {
  moveset?: string;
  efectividad?: string;
};

/** An element the effectiveness codes name: its id and its name in the file's language. */
export type PanelElement = readonly [id: string, nombre: string];

/** The shape of `/{l}/paneles.json`. */
export interface PanelsData {
  v: 1;
  etiquetas: Partial<TipExtraLabels>;
  items: Readonly<Record<string, PanelItem>>;
  pokemon: Readonly<Record<string, PanelPokemon>>;
  /** The names of the Balls that favour an element, by element id. */
  elementos: Readonly<Record<string, readonly string[]>>;
  /** The names of the Balls that unlock an aura, by aura id. */
  auras: Readonly<Record<string, readonly string[]>>;
  /** The name of the Pokémon of an addon, by addon id. */
  addons: Readonly<Record<string, string>>;
  /** The elements the `efectividad` codes of `pokemon` point at, in their order. */
  tipos?: readonly PanelElement[];
}

/** Where the file of `locale` is. */
export function panelsUrl(locale: Locale): string {
  return `/${locale}/paneles.json`;
}

function isTable(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The file, or an error for any other shape (PR5: data that does not decode is not loaded). */
export function decodePanels(json: unknown): PanelsData {
  const file = json as Partial<PanelsData> | null;
  if (
    file?.v !== 1 ||
    ![file.etiquetas, file.items, file.pokemon, file.elementos, file.auras, file.addons].every(
      isTable,
    )
  ) {
    throw new Error('paneles.json: unknown shape');
  }
  return file as PanelsData;
}

const requests = new Map<string, Promise<PanelsData>>();

/** The file of `url`, asked for once per page; a failed request is asked for again next time. */
export function loadPanels(url: string): Promise<PanelsData> {
  let request = requests.get(url);
  if (request === undefined) {
    request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`paneles.json: ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then(decodePanels);
    request.catch(() => requests.delete(url));
    requests.set(url, request);
  }
  return request;
}

/**
 * The panels file of `locale` once it is here, `null` before: asked for when the island is idle
 * after hydrating, so the first render is the prerendered one. A failure leaves it `null`.
 */
export function usePanels(locale: Locale): PanelsData | null {
  const [panels, setPanels] = useState<PanelsData | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => {
      loadPanels(panelsUrl(locale)).then(
        (data) => {
          if (live) setPanels(data);
        },
        () => {},
      );
    };
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(load);
      return () => {
        live = false;
        window.cancelIdleCallback(handle);
      };
    }
    const handle = window.setTimeout(load);
    return () => {
      live = false;
      window.clearTimeout(handle);
    };
  }, [locale]);
  return panels;
}
