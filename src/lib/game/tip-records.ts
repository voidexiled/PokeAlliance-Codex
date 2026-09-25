// The records the tooltip builders of ./tips.ts read, composed on the server from the
// registries (7.5.3): an item with every fact of its panel, a Pokémon with its element names,
// moveset, traits and abilities, an element with its Balls, an aura with the Balls that unlock
// it and an addon with its Pokémon. Every page, every `datos.json` and every island prop that
// draws a panel starts from here, so a panel shows the same rows wherever the entity is named
// (owner rule 2026-09-25: every tooltip complete, everywhere).
//
// Server only: it reads the registries. Islands receive what it composes as props or in their
// data files (AGENTS.md: Zod stays on the server).
import type { Locale } from '@/i18n/config';
import {
  getAuras,
  getCategorias,
  getElementos,
  getItems,
  getOutfits,
  getSpriteRegistry,
} from '@/lib/content/registry';
import type { Aura, Elemento, Item } from '@/lib/content/registry-schema';
import { getPokemon } from '@/lib/content/repository';
import type { PokemonRecord } from '@/lib/content/types';
import {
  droppersOf,
  itemFactsIndex,
  itemTipFacts,
  megaStoneByForm,
  type ItemFactsIndex,
} from '@/lib/game/item-facts';
import type {
  ElementTipRecord,
  GearTipRecord,
  ItemTipRecord,
  PokemonTipRecord,
  TipSprite,
} from '@/lib/game/tips';
import { effectivenessGroups, effectivenessIcons } from '@/lib/game/pokemon-panel';
import { spriteOrNull } from '@/lib/sprites/resolve';

const indexes = new Map<Locale, ItemFactsIndex>();

/** The lookups of the panels of `locale`, built once per build. */
export function tipIndex(locale: Locale): ItemFactsIndex {
  let index = indexes.get(locale);
  if (index === undefined) {
    index = itemFactsIndex(
      { pokemon: getPokemon(), items: getItems(), elementos: getElementos(), auras: getAuras() },
      locale,
    );
    indexes.set(locale, index);
  }
  return index;
}

/**
 * An item with every fact of its panel: its category name, sprite, «Drop de» (the Pokémon that
 * drop it in any zone), prices and `ItemTipFacts`. `sprite` overrides the registry's sprite (a
 * page that already resolved it with options, a quantity frame…).
 */
export function itemTipRecord(
  item: Item,
  locale: Locale,
  options: { sprite?: TipSprite | null } = {},
): ItemTipRecord {
  const index = tipIndex(locale);
  const category = getCategorias().find((entry) => entry.id === item.categoria);
  return {
    id: item.id,
    nombre: item.nombre,
    categoria: item.categoria,
    sprite:
      options.sprite !== undefined
        ? options.sprite
        : spriteOrNull(getSpriteRegistry(), item.sprite),
    precioNpc: item.precioNpc,
    nombreCategoria: category?.nombre ?? null,
    dropDe: droppersOf(item.id, index).map((record) => record.nombre),
    uso: item.uso ?? null,
    ...itemTipFacts(item, index),
  };
}

let megaStones: Map<string, string> | undefined;

/** The Mega Stone of each Mega form by the form's id; names do not translate (13.4). */
export function megaStoneOf(id: string): string | undefined {
  megaStones ??= megaStoneByForm(
    getPokemon().map((record) => record.id),
    getItems(),
  );
  return megaStones.get(id);
}

/** The element records of `content/elementos.json` by id. */
function elementsById(): Map<string, Elemento> {
  return new Map(getElementos().map((element) => [element.id, element]));
}

/**
 * A Pokémon as its panel reads it: the record, the names of its elements and of its moveset
 * element, its number, traits and abilities (they are fields of the record, spread as they are).
 */
export function pokemonTipRecord(
  record: PokemonRecord,
  aura?: PokemonTipRecord['aura'],
): PokemonTipRecord {
  const elements = elementsById();
  const moveset = record.elementoMoveset ? elements.get(record.elementoMoveset) : undefined;
  return {
    ...record,
    elementos: record.elementos.flatMap((id) => {
      const element = elements.get(id);
      return element === undefined ? [] : [{ nombre: element.nombre }];
    }),
    moveset: moveset === undefined ? null : { nombre: moveset.nombre },
    megaStone: megaStoneOf(record.id) ?? null,
    efectividadIconos: record.efectividad
      ? effectivenessIcons(
          effectivenessGroups(record.efectividad),
          (id) => elements.get(id)?.nombre,
        )
      : null,
    ...(aura ? { aura } : {}),
  };
}

/** An element as its panel reads it: its Stone and Fragment by name and the Balls that favour it. */
export function elementTipRecord(element: Elemento, locale: Locale): ElementTipRecord {
  const items = new Map(getItems().map((item) => [item.id, item.nombre]));
  return {
    id: element.id,
    nombre: element.nombre,
    icono: spriteOrNull(getSpriteRegistry(), element.icono),
    stone: element.stone === null ? null : (items.get(element.stone) ?? null),
    fragment: element.fragment === null ? null : (items.get(element.fragment) ?? null),
    balls: tipIndex(locale).ballsByElement.get(element.id) ?? [],
  };
}

/** An aura as its panel reads it: its name, its ball sprite and the Balls that unlock it. */
export function auraTipRecord(aura: Aura, locale: Locale): GearTipRecord {
  return {
    id: aura.id,
    nombre: aura.nombre,
    sprite: spriteOrNull(getSpriteRegistry(), aura.icono),
    balls: tipIndex(locale).ballsByAura.get(aura.id) ?? [],
  };
}

/** Every addon of content/outfits.json by id, with the name of its outfit's Pokémon. */
export function addonTipRecords(locale: Locale): Map<string, GearTipRecord> {
  const names = tipIndex(locale).pokemonName;
  const registry = getSpriteRegistry();
  return new Map(
    getOutfits().flatMap((outfit) =>
      outfit.addons.map((addon) => [
        addon.id,
        {
          id: addon.id,
          nombre: addon.nombre,
          sprite: spriteOrNull(registry, addon.sprite),
          pokemon: names.get(outfit.pokemon) ?? null,
        },
      ]),
    ),
  );
}
