// Zod mirror of the JSON Schemas for the game data under content/ (Pokémon,
// moves, quests, locations, rotations, system items and the map). The value
// lists come from the JSON Schemas themselves, so a new tier or element is
// added in one place. tests/content/registry.test.ts checks that both accept
// and reject the same documents. Server-only: React islands get this data as
// props and never bundle Zod.
import movesJsonSchema from '@content/schemas/moves.schema.json';
import pokemonJsonSchema from '@content/schemas/pokemon.schema.json';
import { z } from 'zod';

import { locales, type Locale } from '@/i18n/config';

import type { ContentRef } from './types';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const spriteKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/);
const text = z.string().min(1);
/** A string with at least one character that is not a space (`"pattern": "\\S"`). */
const prose = z.string().regex(/\S/);
const optionalText = text.nullable();
const textList = z.array(text);
const schemaRef = z.string().optional();

function oneOf<T>(values: readonly T[]) {
  return z.custom<T>((value) => values.includes(value as T), {
    message: `Debe ser uno de: ${values.map((value) => JSON.stringify(value)).join(', ')}.`,
  });
}

const { $defs } = pokemonJsonSchema;

/** `Ref` of §3.13: an entity with its own registry. */
const ref = z.strictObject({
  tipo: oneOf($defs.ref.properties.tipo.enum as readonly ContentRef['tipo'][]),
  id: slug,
});

/** `EnlaceDato` of §3.13: a text, and the entity it opens when it has one. */
const enlaceDato = z.strictObject({ texto: text, ref: ref.optional() });

// `cantidad.max ≥ min`, the references and the cycles of `evolucion` are checked by
// `pnpm content:check` (§3.13), which reads every file at once; the mirror keeps to the
// JSON Schema.
const drop = z
  .strictObject({
    item: slug,
    cantidad: z
      .strictObject({ min: z.number().int().min(1), max: z.number().int().min(1) })
      .nullable(),
    /** Optional: the % the game's Pokédex shows (`chance / 1000`); `null` while unknown. */
    probabilidad: z.number().min(0).max(100).nullable().optional(),
    /** Optional: the game shows «Muy Raro» and hides the real rate; `probabilidad` is `null`. */
    muyRaro: z.literal(true).optional(),
  })
  .refine((value) => value.muyRaro !== true || value.probabilidad == null, {
    message: 'Un drop con "muyRaro" lleva "probabilidad": null.',
    path: ['probabilidad'],
  });

/**
 * `textoJuego`: a text of the game in the language or languages it exists in, one at least.
 * The page of the other language shows it in the one there is, inside its `lang` (`textIn`).
 */
const gameText = z
  .strictObject({ es: prose.optional(), en: prose.optional() })
  .refine((value) => value.es !== undefined || value.en !== undefined, {
    message: 'Un texto necesita "es", "en" o los dos.',
  });

const element = oneOf($defs.elemento.enum);

/** One move of a Pokémon, in the game's order, with the slot and cooldowns it has there. */
const pokemonMove = z.strictObject({
  movimiento: slug,
  slot: text.nullable(),
  cooldownPve: z.number().min(0).nullable(),
  cooldownPvp: z.number().min(0).nullable(),
  /** Optional: what this Pokémon's version of the move has when it is not the move's own. */
  elemento: element.nullable().optional(),
  alcance: oneOf($defs.movimientoPokemon.properties.alcance.enum).optional(),
  efectos: z.array(slug).optional(),
});

const evolucion = z.strictObject({
  a: slug,
  nivel: z.number().int().min(1).nullable(),
  items: z.array(z.strictObject({ item: slug, cantidad: z.number().int().min(1) })),
});

export const pokemonSchema = z.strictObject({
  id: slug,
  nombre: text,
  numero: z.number().int().min(1).nullable(),
  generacion: z.number().int().min(1).nullable(),
  variante: oneOf($defs.variante.enum),
  nivel: z.number().int().min(1).nullable(),
  tier: z.union([z.number().int().min(1), oneOf($defs.tierEspecial.enum), z.null()]),
  funcion: oneOf($defs.funcion.enum),
  elementos: z.array(oneOf($defs.elemento.enum)).max(2),
  imagen: z
    .string()
    .regex(/^\/pokemon\/[0-9]+(?:\.[0-9]+)?\.png$/)
    .nullable(),
  // The optional fields of §3.13: while one is missing, its row or section is not drawn.
  hp: z.number().int().min(1).nullable().optional(),
  experiencia: z.number().int().min(0).nullable().optional(),
  drops: z.array(drop).optional(),
  evolucion: z.array(evolucion).optional(),
  habilidades: z.array(text).optional(),
  donde: z
    .strictObject({
      hunts: z.array(enlaceDato),
      linkedTasks: z.array(enlaceDato),
      equiposNpc: z.array(enlaceDato),
    })
    .optional(),
  elementoMoveset: oneOf($defs.elemento.enum).nullable().optional(),
  // Fields of the game's Pokédex the importer fills (importer_plan.md §2).
  descripcion: gameText.nullable().optional(),
  rapido: z.boolean().nullable().optional(),
  pesado: z.boolean().nullable().optional(),
  movimientos: z.array(pokemonMove).optional(),
  dropsPorZona: z
    .strictObject({ wildscape: z.array(drop).optional(), primal: z.array(drop).optional() })
    .optional(),
  efectividad: z
    .strictObject({
      muyDebil: z.array(element),
      debil: z.array(element),
      resiste: z.array(element),
      muyResistente: z.array(element),
      inmune: z.array(element),
    })
    .optional(),
});

export const pokemonFileSchema = z.strictObject({
  $schema: schemaRef,
  pokemon: z.array(pokemonSchema),
});

export const movesFileSchema = z.strictObject({
  $schema: schemaRef,
  movimientos: z.array(
    z.strictObject({
      id: slug,
      nombre: text,
      // An element id of content/elementos.json (§3.13), not its name.
      elemento: oneOf(movesJsonSchema.$defs.elemento.enum).nullable(),
      slot: optionalText,
      cooldownSegundos: z.number().min(0).nullable(),
      modo: optionalText,
      pokemon: z.array(slug),
      /**
       * Optional (§16.2.2): "area" (aoe), "objetivo" (target) o "pasivo" (passive), etiquetas
       * del Pokédex del juego. null si no se conoce.
       */
      alcance: oneOf(movesJsonSchema.$defs.movimiento.properties.alcance.enum).optional(),
      /** Optional: the effect ids of the game's Pokédex («damage», «paralyze»…). */
      efectos: z.array(slug).optional(),
      /** Optional: the description the game shows, in the language or languages it has. */
      descripcion: gameText.nullable().optional(),
      /** Optional: the sprite key of the move's icon. */
      icono: spriteKey.nullable().optional(),
    }),
  ),
});

/**
 * A text of an activity (§3.13, `texto` of quests.schema.json): the text in each language it
 * exists in, one at least. While a text exists only in English it carries `en` alone, and the
 * Spanish page shows it in English inside `lang="en"` (8.9, T22, L-04); `textIn` picks it for a
 * page. The JSON Schema says «one at least» with `if`/`else`; the mirror, with a refinement.
 */
const questText = z
  .strictObject({ es: prose.optional(), en: prose.optional() })
  .refine((value) => value.es !== undefined || value.en !== undefined, {
    message: 'Un texto necesita "es", "en" o los dos.',
  });

/**
 * An activity of content/quests.json (§3.13, §8.9): its page `/{l}/actividades/{id}/` and its
 * entry in the index, the menu and the search. `nombre` and the NPCs are names of the game and
 * read the same in both languages (13.4); `lugares`, `pokemon` and `sistemas` are names with no
 * entity and are not drawn (R2). `sprite` is the optional key of the index entry and of the
 * banner: missing or `null`, the index cell stays empty and the banner shows the
 * missing-sprite mark (8.9).
 */
export const questSchema = z.strictObject({
  id: slug,
  nombre: text,
  nivelRequerido: z.number().int().min(1).nullable(),
  resumen: questText.nullable(),
  instrucciones: questText.nullable(),
  requisitos: z.array(questText),
  pasos: z.array(questText),
  recompensas: z.array(questText),
  npcs: textList,
  lugares: textList,
  pokemon: textList,
  sistemas: textList,
  notas: z.array(questText),
  sprite: spriteKey.nullable().optional(),
});

export const questsFileSchema = z.strictObject({
  $schema: schemaRef,
  misiones: z.array(questSchema),
});

/** A text of an activity: `es`, `en` or both (§3.13). */
export type QuestText = z.infer<typeof questText>;
/** An activity of content/quests.json (§3.13, §8.9). */
export type Quest = z.infer<typeof questSchema>;

/** A text as a page draws it (T22). */
export interface ShownText {
  text: string;
  /**
   * The `lang` of the element that holds the text: present only when the text is not in the
   * page's language.
   */
  lang?: Locale;
}

/**
 * The text of a record for a page in `locale` (8.0.5, T22, WA4): its own language when the
 * record has it; otherwise the language it has, with that `lang`. So a phrase that exists only
 * in English shows in English on the Spanish page inside `lang="en"`, and one that exists only
 * in Spanish shows on the English page inside `lang="es"`. Names of the game never go through
 * here: they carry no `lang` (13.4).
 */
export function textIn(value: Partial<Record<Locale, string>>, locale: Locale): ShownText {
  const own = value[locale];
  if (own !== undefined) return { text: own };
  const lang = locales.find((option) => value[option] !== undefined);
  // The schemas give every text one language at least; a value without any is a bug.
  if (lang === undefined) throw new Error('textIn: el texto no tiene ningún idioma.');
  return { text: value[lang] as string, lang };
}

export const locationsFileSchema = z.strictObject({
  $schema: schemaRef,
  ubicaciones: z.array(
    z.strictObject({
      id: slug,
      nombre: text,
      tipo: optionalText,
      region: optionalText,
      acceso: textList,
      viajes: z.array(z.strictObject({ modo: text, comando: optionalText })),
    }),
  ),
});

export const rotationsFileSchema = z.strictObject({
  $schema: schemaRef,
  rotaciones: z.array(
    z.strictObject({
      id: slug,
      nombre: text,
      tipo: optionalText,
      disponibilidad: optionalText,
      condicion: optionalText,
      excluye: textList,
      comparacion: textList,
    }),
  ),
});

// `content/system-items.json` is read with the system pages (E16): one schema, with `sprite`.
export { systemItemsFileSchema } from './registry-schema';

const coordinate = z.number().int().min(0);
const floor = z.number().int().min(0).max(15);

export const mapMarkersFileSchema = z.strictObject({
  $schema: schemaRef,
  marcadores: z.array(
    z.strictObject({
      id: z.number().int().min(1),
      descripcion: z.string().nullable(),
      x: coordinate,
      y: coordinate,
      z: floor,
      icono: z.number().int().min(0),
    }),
  ),
});

export const mapFloorsFileSchema = z.strictObject({
  $schema: schemaRef,
  pisos: z.array(
    z.strictObject({
      z: floor,
      imagen: z.string().regex(/^\/data\/map\/otmm\/floor-[0-9]+\.png$/),
      ancho: z.number().int().min(1),
      alto: z.number().int().min(1),
      limites: z.strictObject({
        minX: coordinate,
        minY: coordinate,
        maxX: coordinate,
        maxY: coordinate,
      }),
    }),
  ),
});

/** Parses one content file; a malformed file fails the build with its path. */
export function parseContent<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${file} no es válido:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
