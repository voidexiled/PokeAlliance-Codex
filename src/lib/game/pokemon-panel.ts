// The Pokémon part of `/{l}/paneles.json` (src/lib/game/panels.ts) as a panel reads it: the
// effectiveness codes, written by src/pages/[locale]/paneles.json.ts and by the server panels
// (src/lib/game/tip-records.ts), and `pokemonPanel`, the facts of the file as a
// `PokemonTipRecord`. A module apart from panels.ts, so an island that only loads the file (the
// Tier list) does not take the element icons into its initial JS (13.6).
//
// Client-safe: no registry, no Zod.
import type { Locale } from '@/i18n/config';
import type { PanelElement, PanelPokemon } from '@/lib/game/panels';
import { elementSprite } from '@/lib/pickers/sprites';
import type { LocalizedText, PokemonTipRecord, TipEffectiveness } from '@/lib/game/tips';

/** A Pokémon's `efectividad` as its panel groups it: element ids, in registry order. */
export interface EffectivenessIds {
  debil: readonly string[];
  resiste: readonly string[];
  inmune: readonly string[];
}

/** A record's `efectividad` as content/pokemon.json writes it: the five groups of the game's Pokédex. */
export interface EffectivenessRecord {
  muyDebil: readonly string[];
  debil: readonly string[];
  resiste: readonly string[];
  muyResistente: readonly string[];
  inmune: readonly string[];
}

/** The three groups of a panel: Débil a (×2, ×1,5), Resiste (×0,5, ×0,4) and Inmune (×0). */
export function effectivenessGroups(record: EffectivenessRecord): EffectivenessIds {
  return {
    debil: [...record.muyDebil, ...record.debil],
    resiste: [...record.resiste, ...record.muyResistente],
    inmune: [...record.inmune],
  };
}

const CODE_BASE = 'a'.charCodeAt(0);
const GROUPS = ['debil', 'resiste', 'inmune'] as const;

/**
 * «weak|resists|immune» with one letter per element of `order` (`a` = `order[0]`), or
 * `undefined` when every group is empty or names an element outside `order`.
 */
export function encodeEffectiveness(
  groups: EffectivenessIds,
  order: readonly string[],
): string | undefined {
  const codes: string[] = [];
  for (const group of GROUPS) {
    let code = '';
    for (const id of groups[group]) {
      const index = order.indexOf(id);
      if (index < 0 || index > 25) return undefined;
      code += String.fromCharCode(CODE_BASE + index);
    }
    codes.push(code);
  }
  return codes.every((code) => code === '') ? undefined : codes.join('|');
}

/**
 * The element icons of each group, from the element names `nombre` gives by id; an element
 * without a name is left out.
 */
export function effectivenessIcons(
  groups: EffectivenessIds,
  nombre: (id: string) => LocalizedText | undefined,
): TipEffectiveness {
  const icons = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const name = nombre(id);
      return name === undefined ? [] : [{ nombre: name, sprite: elementSprite(id, 16) }];
    });
  return {
    debil: icons(groups.debil),
    resiste: icons(groups.resiste),
    inmune: icons(groups.inmune),
  };
}

/** The icons of an `efectividad` code; `undefined` for a code that does not decode. */
export function decodeEffectiveness(
  code: string | undefined,
  tipos: readonly PanelElement[] | undefined,
  locale: Locale,
): TipEffectiveness | undefined {
  if (typeof code !== 'string' || !Array.isArray(tipos)) return undefined;
  const parts = code.split('|');
  if (parts.length !== GROUPS.length) return undefined;
  const names = new Map(tipos.map(([id, name]) => [id, name]));
  const ids = parts.map((part) =>
    [...part].flatMap((letter) => {
      const element = tipos[letter.charCodeAt(0) - CODE_BASE];
      return Array.isArray(element) ? [element[0]] : [];
    }),
  );
  return effectivenessIcons({ debil: ids[0], resiste: ids[1], inmune: ids[2] }, (id) => {
    const name = names.get(id);
    return name === undefined ? undefined : ({ [locale]: name } as LocalizedText);
  });
}

/**
 * The part of a Pokémon's panel record the file gives: its number, traits, abilities, the
 * name of its moveset element as the `Texto` of the page's language and, with the file's
 * `tipos`, its effectiveness as element icons.
 */
export function pokemonPanel(
  extra: PanelPokemon | undefined,
  locale: Locale,
  tipos?: readonly PanelElement[],
): Partial<PokemonTipRecord> {
  if (extra === undefined) return {};
  const { moveset, efectividad, ...rest } = extra;
  const icons = decodeEffectiveness(efectividad, tipos, locale);
  return {
    ...rest,
    ...(moveset === undefined
      ? {}
      : { moveset: { nombre: { [locale]: moveset } as Record<Locale, string> } }),
    ...(icons === undefined ? {} : { efectividadIconos: icons }),
  };
}
