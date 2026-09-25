// Zod mirror of content/schemas/*.schema.json (JSON Schema 2020-12). Keep both
// in sync: tests/content/registry.test.ts checks that they accept and reject
// the same documents, tests/content/destacados.test.ts and
// tests/content/mundos.test.ts do the same for the two registries of the Inicio,
// and tests/content/cambios.test.ts for the Cambios registry.
import cambiosJsonSchema from '@content/schemas/cambios.schema.json';
import categoriasJsonSchema from '@content/schemas/categorias.schema.json';
import destacadosJsonSchema from '@content/schemas/destacados.schema.json';
import elementosJsonSchema from '@content/schemas/elementos.schema.json';
import itemsJsonSchema from '@content/schemas/items.schema.json';
import sistemasJsonSchema from '@content/schemas/sistemas.schema.json';
import tiersJsonSchema from '@content/schemas/tiers.schema.json';
import { z } from 'zod';

import { spriteDirections, spriteModes } from '@/lib/sprites/resolve';

import type { ContentRef } from './types';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const spriteKeyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const archivoPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\.png$/;
/** A route of the site without its locale and with the final slash: `/pokedex/tiers/`, `/`. */
const routePattern = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/;

/**
 * The 14 Market categories in client order, then the site's own categories and «otros», read
 * from categorias.schema.json (the only place that lists them). "todo" is virtual; `mercado` is
 * true for the 13 that are categories of the game's Market (the site's own ones and «otros» are
 * not).
 */
export const marketCategories = categoriasJsonSchema.properties.categorias.prefixItems.map(
  (entry, orden) => ({
    id: entry.properties.id.const,
    orden,
    virtual: entry.properties.virtual.const,
    mercado: entry.properties.mercado.const,
  }),
);

/** Categories with their own content/items/<id>.json file. */
export const itemCategoryIds = marketCategories
  .filter((categoria) => !categoria.virtual)
  .map((categoria) => categoria.id);

const slug = z.string().regex(slugPattern);
const spriteKey = z.string().regex(spriteKeyPattern);
const archivo = z.string().regex(archivoPattern);
const positive = z.number().int().min(1);
const text = z.string().min(1);
const schemaRef = z.string().optional();

export const categoriaSchema = z.strictObject({
  id: slug,
  nombre: z.strictObject({ es: text, en: text }),
  icono: spriteKey,
  orden: z.number().int().min(0),
  virtual: z.boolean().optional(),
  /** true for a category of the game's Market; missing (or false) on the site's own ones. */
  mercado: z.boolean().optional(),
});

export const categoriasFileSchema = z.strictObject({
  $schema: schemaRef,
  categorias: z
    .array(categoriaSchema)
    .length(marketCategories.length)
    .superRefine((categorias, context) => {
      categorias.forEach((categoria, index) => {
        const expected = marketCategories[index];
        if (!expected) return;
        const issue = (message: string, field: string) =>
          context.addIssue({ code: 'custom', message, path: [index, field] });
        if (categoria.id !== expected.id) issue(`Aquí va la categoría "${expected.id}".`, 'id');
        if (categoria.orden !== expected.orden) issue(`orden debe ser ${expected.orden}.`, 'orden');
        if ((categoria.virtual ?? false) !== expected.virtual)
          issue(
            expected.virtual ? 'Esta categoría es virtual.' : 'Esta categoría no es virtual.',
            'virtual',
          );
        if ((categoria.mercado ?? false) !== expected.mercado)
          issue(
            expected.mercado
              ? 'Esta categoría es del Market: "mercado": true.'
              : 'Esta categoría no es del Market: sin "mercado" (o false).',
            'mercado',
          );
      });
    }),
});

const price = z.number().int().min(0).nullable();

/**
 * The element ids an item may name (§3.13), read from items.schema.json; `pnpm content:check`
 * keeps that list equal to the 18 of elementos.schema.json, in their order.
 */
const itemElementIds = itemsJsonSchema.$defs.elemento.enum as readonly string[];

/** A string with at least one character that is not a space (`"pattern": "\\S"`). */
const itemProse = z.string().regex(/\S/);

/** `HELD_TIER_MAX` of §16.2.3 (Q8, respuesta del propietario: «pon que 8»). */
export const HELD_TIER_MAX = 8;

/**
 * `held` of §16.2.3: obligatorio para `categoria === "helds"`. Cada tier de un efecto es su
 * propio ítem (X-Attack T1, X-Attack T2…), así se puede filtrar y ordenar por tier.
 */
export const heldSchema = z.strictObject({
  /** null when the game does not say it (a «Held Item (Tier: n)» that gives a random held). */
  ranura: z.enum(['x', 'y']).nullable(),
  efecto: itemProse,
  tier: z.number().int().min(1).max(HELD_TIER_MAX),
});

/** `mega` de §16.2.3: opcional en cualquier categoría, marca una Mega Stone. */
export const megaSchema = z.strictObject({
  pokemon: z.array(slug),
});

/**
 * `ball`: what the game says of a Poké Ball. `elementos` and `condicion` come from its inspection
 * (pnpm content:datamine); `tasa` (its multiplier, which the client does not carry) and `aura`
 * (the id of content/auras.json the ball unlocks) are the owner's. `pnpm content:check` checks
 * that the aura exists.
 */
export const ballSchema = z.strictObject({
  tasa: z.number().min(0).nullable(),
  elementos: z.array(
    z.custom<string>((value) => itemElementIds.includes(value as string), {
      message: `Debe ser uno de: ${itemElementIds.join(', ')}.`,
    }),
  ),
  condicion: z.enum(['rapido', 'pesado']).nullable(),
  aura: slug.nullable(),
});

/** `textoJuego`: a text of the game in the language or languages it exists in, one at least. */
const itemGameText = z
  .strictObject({ es: itemProse.optional(), en: itemProse.optional() })
  .refine((value) => value.es !== undefined || value.en !== undefined, {
    message: 'Un texto necesita "es", "en" o los dos.',
  });

const obtencionDefs = itemsJsonSchema.$defs.obtencion.properties;
const itemAmount = positive.nullable();
const track = z.enum(itemsJsonSchema.$defs.pista.enum as ['gratis', 'premium']);

/**
 * `obtencion`: the ways to get an item the game shows besides the Pokémon loot (computed from
 * content/pokemon.json) and the NPC price (`precioNpc`). The importer fills it
 * (importer_plan.md §8); a list that is missing or empty is not drawn.
 */
export const obtencionSchema = z.strictObject({
  tiendas: z
    .array(
      z.strictObject({
        tienda: text,
        precio: z.number().int().min(0).nullable(),
        moneda: text.nullable(),
        cantidad: itemAmount,
      }),
    )
    .optional(),
  pase: z
    .array(
      z.strictObject({
        temporada: positive.nullable(),
        nivel: positive.nullable(),
        pista: track,
        cantidad: itemAmount,
      }),
    )
    .optional(),
  calendario: z
    .array(
      z.strictObject({
        mes: z.number().int().min(1).max(12).nullable(),
        dia: z.number().int().min(1).max(21).nullable(),
        trasDia21: z.boolean(),
        calendario: track,
        cantidad: itemAmount,
      }),
    )
    .optional(),
  tareas: z
    .array(
      z.strictObject({
        tipo: z.enum(
          obtencionDefs.tareas.items.properties.tipo.enum as [
            'quest',
            'linked-task',
            'poke-task',
            'daily',
            'logro',
            'dungeon',
          ],
        ),
        nombre: text,
        actividad: slug.optional(),
        cantidad: itemAmount,
      }),
    )
    .optional(),
  /** The game's boxes that give it (a toy: its Toy Box), by item id, and the chance if known. */
  cajas: z
    .array(
      z.strictObject({
        item: slug,
        probabilidad: z.number().min(0).max(100).nullable(),
      }),
    )
    .optional(),
  recetas: z
    .array(
      z.strictObject({
        taller: text.nullable(),
        cantidad: itemAmount,
        tiempoSegundos: z.number().min(0).nullable(),
        materiales: z.array(z.strictObject({ item: slug, cantidad: itemAmount })),
      }),
    )
    .optional(),
});

const itemShape = z.strictObject({
  id: slug,
  nombre: text,
  clientId: positive.nullable(),
  categoria: z.custom<string>((value) => itemCategoryIds.includes(value as string), {
    message: `Debe ser una de: ${itemCategoryIds.join(', ')}.`,
  }),
  sprite: spriteKey,
  apilable: z.boolean().nullable(),
  precioNpc: z.strictObject({ vende: price, compra: price }),
  /**
   * Optional (§3.13): the element id of the «Elemento» key of its card, its row and its panel
   * (§8.5, §7.5.3); `null` while unknown. Missing, the key is not drawn (§8.0.5).
   */
  elemento: z
    .custom<string>((value) => itemElementIds.includes(value as string), {
      message: `Debe ser uno de: ${itemElementIds.join(', ')}.`,
    })
    .nullable()
    .optional(),
  /**
   * Optional (§3.13): the «Uso» of its card, its row and its panel, a `Texto` in both locales;
   * `null` while unknown. A game amount written in it is refused by `pnpm content:check`.
   */
  uso: z.strictObject({ es: itemProse, en: itemProse }).nullable().optional(),
  borrador: z.boolean().optional(),
  /** Optional (§16.2.3), obligatorio para `categoria === "helds"` (ver `superRefine` abajo). */
  held: heldSchema.optional(),
  /** Optional en cualquier categoría (§16.2.3): marca una Mega Stone. */
  mega: megaSchema.optional(),
  /** Optional: the facts of a Poké Ball (see `ballSchema`). */
  ball: ballSchema.optional(),
  /** Optional: the text of the item's inspection in the game, without «You see …». */
  descripcion: itemGameText.nullable().optional(),
  /** Optional: the ways to get it besides loot and the NPC (see `obtencionSchema`). */
  obtencion: obtencionSchema.optional(),
  /** Optional: whether the game's Market accepts it; `null` or missing while unknown. */
  mercado: z.boolean().nullable().optional(),
});

export const itemSchema = itemShape.superRefine((item, context) => {
  if (item.categoria === 'helds' && item.held === undefined)
    context.addIssue({ code: 'custom', message: 'Falta "held".', path: ['held'] });
});

/** One list in both locales, in the same order (§3.13): an empty one makes no row. */
const monedaLista = z.strictObject({ es: z.array(itemProse), en: z.array(itemProse) });

/**
 * The `moneda` object of content/items/diamantes.json (§3.13): where players buy Diamonds and
 * what they spend them on, the rows of `diamondsTip` (§7.5.3) and the facts «Se compran en» and
 * «Se usan en» of a Diamonds listing (§9.5.8). The owner fills it; a list is `null` while
 * unknown. `pnpm content:check` refuses it in any other items file. tests/trade/registry.test.ts
 * checks this mirror against items.schema.json.
 */
export const monedaSchema = z.strictObject({
  seCompranEn: monedaLista.nullable(),
  seUsanEn: monedaLista.nullable(),
});

export type Moneda = z.infer<typeof monedaSchema>;

export const itemsFileSchema = z.strictObject({
  $schema: schemaRef,
  moneda: monedaSchema.optional(),
  items: z.array(itemSchema),
});

export const addonSchema = z.strictObject({
  id: slug,
  nombre: text,
  outfitId: positive,
  sprite: spriteKey,
  borrador: z.boolean().optional(),
});

export const outfitSchema = z.strictObject({
  pokemon: slug,
  outfitId: positive,
  addons: z.array(addonSchema),
  borrador: z.boolean().optional(),
});

export const outfitsFileSchema = z.strictObject({
  $schema: schemaRef,
  outfits: z.array(outfitSchema),
});

export const auraShaders = ['outfit_alliance', 'outfit_rainbow'] as const;

export const auraSchema = z.strictObject({
  id: slug,
  nombre: text,
  shader: z.enum(auraShaders),
  icono: spriteKey,
  borrador: z.boolean().optional(),
});

export const aurasFileSchema = z.strictObject({
  $schema: schemaRef,
  auras: z.array(auraSchema),
});

export const spriteEntrySchema = z
  .strictObject({
    archivo,
    frame: z.tuple([positive, positive]),
    frames: positive,
    modo: z.enum(spriteModes),
    umbrales: z.array(positive).min(1).optional(),
    duracionMs: z.array(positive).min(1).optional(),
    loop: z.boolean().optional(),
    direcciones: z
      .strictObject(
        Object.fromEntries(spriteDirections.map((name) => [name, archivo])) as {
          [K in (typeof spriteDirections)[number]]: typeof archivo;
        },
      )
      .optional(),
    borrador: z.boolean().optional(),
  })
  .superRefine((entry, context) => {
    const issue = (message: string, path: string) =>
      context.addIssue({ code: 'custom', message, path: [path] });
    if (entry.modo === 'estatico' && entry.frames !== 1)
      issue('Un sprite estatico tiene 1 frame.', 'frames');
    if (entry.modo === 'cantidad' && !entry.umbrales)
      issue('El modo cantidad necesita umbrales.', 'umbrales');
    if (entry.modo === 'animacion' && !entry.duracionMs)
      issue('El modo animacion necesita duracionMs.', 'duracionMs');
    if (entry.umbrales && entry.modo !== 'cantidad')
      issue('umbrales solo se usa con el modo cantidad.', 'umbrales');
    if (entry.duracionMs && entry.modo !== 'animacion')
      issue('duracionMs solo se usa con el modo animacion.', 'duracionMs');
    if (entry.loop !== undefined && entry.modo !== 'animacion')
      issue('loop solo se usa con el modo animacion.', 'loop');
    if (entry.direcciones && entry.frames !== 1)
      issue('Un sprite con direcciones tiene 1 frame.', 'frames');
  });

export const spritesFileSchema = z.strictObject({
  $schema: schemaRef,
  sprites: z.record(spriteKey, spriteEntrySchema),
});

/**
 * The 18 elements of spec 8.0.5 in their order, read from elementos.schema.json (the only
 * place that lists them, position by position).
 */
export const elementIds = elementosJsonSchema.properties.elementos.prefixItems.map(
  (entry) => entry.properties.id.const,
);

const itemRef = slug.nullable();

export const elementoSchema = z.strictObject({
  id: slug,
  nombre: z.strictObject({ es: text, en: text }),
  icono: spriteKey.nullable(),
  stone: itemRef,
  fragment: itemRef,
});

export const elementosFileSchema = z.strictObject({
  $schema: schemaRef,
  elementos: z
    .array(elementoSchema)
    .length(elementIds.length)
    .superRefine((elementos, context) => {
      elementos.forEach((elemento, index) => {
        const expected = elementIds[index];
        if (expected !== undefined && elemento.id !== expected)
          context.addIssue({
            code: 'custom',
            message: `Aquí va el elemento "${expected}".`,
            path: [index, 'id'],
          });
      });
    }),
});

/**
 * The 12 tiers of spec 16.2.1 in their order, best first, read from tiers.schema.json (the only
 * place that lists them, position by position): ULTIMATE, Mythic, Legendary, Ultra Rare,
 * Super Rare, T1…T7. src/lib/content/tier-rank.ts sorts a Pokémon's `tier` by this same order.
 */
export const tierIds = tiersJsonSchema.properties.tiers.prefixItems.map(
  (entry) => entry.properties.id.const,
);

/**
 * One record of content/tiers.json (§16.2.1): `nombre` is the canonical game name, the same in
 * both locales (D-012 keeps canonical names in English, never translated); `maxBrokes` is `null`
 * until the owner fills it, never `0` as a stand-in for "unknown"; `visible` hides ULTIMATE from
 * the Tier list and the Tier filter without removing its record, so a Pokémon of that tier still
 * resolves one.
 */
export const tierSchema = z.strictObject({
  id: z.custom<(typeof tierIds)[number]>((value) => tierIds.includes(value as string), {
    message: `Debe ser uno de: ${tierIds.join(', ')}.`,
  }),
  nombre: text,
  orden: z.number().int().min(1).max(tierIds.length),
  maxBrokes: z.number().int().min(0).nullable(),
  visible: z.boolean(),
});

export const tiersFileSchema = z.strictObject({
  $schema: schemaRef,
  tiers: z
    .array(tierSchema)
    .length(tierIds.length)
    .superRefine((tiers, context) => {
      tiers.forEach((tier, index) => {
        const expected = tierIds[index];
        if (expected !== undefined && tier.id !== expected)
          context.addIssue({
            code: 'custom',
            message: `Aquí va el tier "${expected}".`,
            path: [index, 'id'],
          });
      });
    }),
});

// ------------------------------------------------------------------ system items (E16)

/**
 * An entry of `content/system-items.json`. `sprite` is the optional key of §3.13 (E16):
 * missing or `null`, its slot and its panel show the missing-sprite mark (7.4.4).
 * `descripcion` is the «Uso» of its card, row and panel, written in English only (L-04).
 */
export const systemItemSchema = z.strictObject({
  id: slug,
  nombre: text,
  tipo: text.nullable(),
  descripcion: text.nullable(),
  /** `id` of its system page in content/sistemas/: the page whose «Ítems» section lists it. */
  sistema: text.nullable(),
  sprite: spriteKey.nullable().optional(),
});

export const systemItemsFileSchema = z.strictObject({
  $schema: schemaRef,
  objetos: z.array(systemItemSchema),
});

// ------------------------------------------------------------------ system pages (§3.13, §8.4)
//
// `content/sistemas/<id>.json`, one file per system page, mirrored field by field from
// content/schemas/sistemas.schema.json. `Lienzo:Sistema-Boost` is the template of every
// system page and every block comes from here, never from a page (§8.4). Conventions of
// §3.13: `Texto` is `{ es, en }`; `null` is «unknown»; an optional field may be missing and
// then its zone is not drawn (§8.0.5).
//
// The text of a block is `TextoEnLinea`, `{ es: EnLinea[], en: EnLinea[] }`: the parts of one
// run of prose, in order, in each locale. The value lists (the `tipo` of a block and of a
// `Ref`, the element ids of a cell) are read from the JSON Schema, the one place that lists
// them. What needs other files or the whole record — an entity with no record, an anchor
// with no section, a repeated or reserved section id, a second note, a row that does not
// match its columns, a game amount written as free text — is checked by `pnpm content:check`,
// which reads every registry at once (§3.13); the mirror keeps to the JSON Schema.

const { $defs: sistemaDefs } = sistemasJsonSchema;

/** A string with at least one character that is not a space (`"pattern": "\\S"`). */
const prose = z.string().regex(/\S/);

/** `Texto` of §3.13: the same text in both locales of the site, without links. */
const texto = z.strictObject({ es: prose, en: prose });

/** A sprite key, or `null` while the sprite registry does not have it. */
const optionalSprite = spriteKey.nullable();

/** `Ref` of §3.13: an entity with its own registry. */
const refTipos = sistemaDefs.ref.properties.tipo.enum as readonly ContentRef['tipo'][];
const ref = z.strictObject({
  tipo: z.custom<ContentRef['tipo']>((value) => refTipos.includes(value as ContentRef['tipo']), {
    message: `Debe ser uno de: ${refTipos.join(', ')}.`,
  }),
  id: slug,
});

/** A game amount in whole units (S8): drawn by `PokedolaresAmount` or `DiamondsAmount` (R5). */
const importe = z.number().int().min(1);

/**
 * `EnLinea` of §3.13, one part of a run of prose (§8.4): text; a link to a section of the same
 * page (`ancla`, the `id` of a section, without `#`) or to a route of the site without its
 * locale and with the final slash (`/pokedex/tiers/`); an entity, drawn as `NestedEntity` with
 * its panel (8.0.5), whose optional `texto` replaces its name; an amount of Pokédólares
 * (`pd`) or of Diamonds (`dia`).
 */
export const enLineaSchema = z.union([
  text,
  z.strictObject({ ancla: slug, texto: prose }),
  z.strictObject({ ruta: z.string().regex(routePattern), texto: prose }),
  z.strictObject({ entidad: ref, texto: prose.optional() }),
  z.strictObject({ pd: importe }),
  z.strictObject({ dia: importe }),
]);

/** The text of a block in both locales; `es` and `en` name the same entities and amounts. */
export const textoEnLineaSchema = z.strictObject({
  es: z.array(enLineaSchema).min(1),
  en: z.array(enLineaSchema).min(1),
});

/** An element id of content/elementos.json (8.0.5). */
const elementoIds = sistemaDefs.elemento.enum as readonly string[];

/**
 * A table cell (§8.4 `tabla`): `null`, «—» (8.0.5); a figure, formatted in the page's locale;
 * an element with its icon and its name, `{ "elemento": "fire" }`; or a text with its parts.
 */
export const celdaSchema = z.union([
  z.null(),
  z.number(),
  z.strictObject({
    elemento: z.custom<string>((value) => elementoIds.includes(value as string), {
      message: `Debe ser uno de: ${elementoIds.join(', ')}.`,
    }),
  }),
  textoEnLineaSchema,
]);

/** `parrafo`: a justified `<p>` of the section with its inline parts (§8.4). */
const parrafo = z.strictObject({ tipo: z.literal('parrafo'), texto: textoEnLineaSchema });

/** `subtitulo`: an h3 of the section. */
const subtitulo = z.strictObject({ tipo: z.literal('subtitulo'), texto: texto });

/**
 * `pasos`: a `Timeline` when every step has a sprite, the `<ol>` of the section otherwise.
 * The label «Paso {n}:» / «Step {n}:» is the page's; `chips` are the step's optional chips.
 */
const pasos = z.strictObject({
  tipo: z.literal('pasos'),
  pasos: z
    .array(
      z.strictObject({
        sprite: optionalSprite,
        texto: textoEnLineaSchema,
        chips: z.array(textoEnLineaSchema).min(1).optional(),
      }),
    )
    .min(1),
});

/**
 * `tabla`: a `DataTable` whose caption is `caption` (WA2), one cell per column in each row.
 * A column may fix its width in px (`ancho`) and show the entities of its cells with their
 * sprite (`conSprite`); `variasLineas` is the `wrap` of the table.
 */
const tabla = z.strictObject({
  tipo: z.literal('tabla'),
  caption: texto,
  columnas: z
    .array(
      z.strictObject({
        titulo: texto,
        ancho: z.number().int().min(1).optional(),
        conSprite: z.boolean().optional(),
      }),
    )
    .min(1),
  filas: z.array(z.array(celdaSchema).min(1)).min(1),
  variasLineas: z.boolean().optional(),
});

/** `nota`: the `Note` of the section («Observación:» / «Note:»), at most one per section. */
const nota = z.strictObject({ tipo: z.literal('nota'), texto: textoEnLineaSchema });

/** `tarjetas`: a grid of `InfoCard` (2 columns, 1 at 390), each a title, a sprite and a text. */
const tarjetas = z.strictObject({
  tipo: z.literal('tarjetas'),
  tarjetas: z
    .array(z.strictObject({ titulo: texto, sprite: optionalSprite, texto: textoEnLineaSchema }))
    .min(2),
});

/** A label that ends with its colon (T33): «Ejemplo con una piedra de 20%:». */
const colonLabel = z.string().regex(/\S.*:$/);

/** `chips`: the label in `ui-step` over an `<ol>` of chips, one text per chip. */
const chips = z.strictObject({
  tipo: z.literal('chips'),
  etiqueta: z.strictObject({ es: colonLabel, en: colonLabel }),
  chips: z.array(textoEnLineaSchema).min(1),
});

/** `lista`: the `<ul>` of the section, one text per point. */
const lista = z.strictObject({
  tipo: z.literal('lista'),
  puntos: z.array(textoEnLineaSchema).min(1),
});

export const bloqueSchema = z.discriminatedUnion('tipo', [
  parrafo,
  subtitulo,
  pasos,
  tabla,
  nota,
  tarjetas,
  chips,
  lista,
]);

/** The eight block types of §8.4, in the order of its table and of the JSON Schema. */
export const bloqueTipos = sistemaDefs.bloque.properties.tipo.enum as readonly z.infer<
  typeof bloqueSchema
>['tipo'][];

/**
 * `id` of the automatic «Ítems» section of 8.4.2 (E16); `item-{id}` is the anchor of each of
 * its items (H7). No section of a record takes either (`pnpm content:check`).
 */
export const SYSTEM_ITEMS_SECTION = 'items';

export const seccionSchema = z.strictObject({
  id: slug,
  titulo: texto,
  bloques: z.array(bloqueSchema).min(1),
});

/** One file of content/sistemas/: the system page of 8.4.2 and its entry everywhere else. */
export const sistemaFileSchema = z.strictObject({
  $schema: schemaRef,
  /** The file name without `.json` and the slug of `/{l}/sistemas/{id}/`. */
  id: slug,
  titulo: texto,
  /** «(Potenciación)» on the board: not drawn while missing (DS:PageTitle). */
  subtitulo: texto.optional(),
  sprite: optionalSprite,
  /** Position in the menu, the index and the Inicio panel, ascending. */
  orden: z.number().int().min(1),
  /** The rows of `systemTip` (7.5.3), labels included, in order; `[]` while it has none. */
  tooltip: z.array(z.strictObject({ etiqueta: texto, valor: texto })),
  /** The lead paragraphs under the title (8.4.2, step 3). */
  intro: z.array(parrafo),
  /** The `InfoBanner` after the lead: its sprite and 1 to 4 facts per locale. */
  banner: z
    .strictObject({
      sprite: optionalSprite,
      datos: z.strictObject({
        es: z.array(prose).min(1).max(4),
        en: z.array(prose).min(1).max(4),
      }),
    })
    .optional(),
  secciones: z.array(seccionSchema),
  /** A placeholder record: OCULTAR_BORRADORES=1 leaves it out of every page (SI4). */
  borrador: z.literal(true).optional(),
});

// ------------------------------------------------------------------ Inicio (§3.13, §8.1)
//
// `content/destacados.json` and `content/mundos.json`, mirrored from their JSON Schemas. Both
// are the owner's (D-011). What needs the whole file or other registries — a route the build
// does not write, a route or a world repeated, a sprite missing from the registry — is checked
// by `pnpm content:check`; the mirror keeps to the JSON Schema.

/** «De 1 a 4» (§3.13), read from destacados.schema.json, the one place that says it. */
const { minItems: destacadosMin, maxItems: destacadosMax } =
  destacadosJsonSchema.properties.destacados;

/**
 * An entry of content/destacados.json: a page of the site that the Inicio features
 * (`FeaturedSection`, §8.1), that Buscar and the 404 repeat (§8.6, §8.12) and that the menu
 * pins in its «Destacados» group with its sprite (§8.0.3). `ruta` is the route without its
 * locale and with the final slash (`/pokedex/tiers/`); `sprite` is `null` while the registry
 * has none.
 */
export const destacadoSchema = z.strictObject({
  etiqueta: texto,
  ruta: z.string().regex(routePattern),
  sprite: optionalSprite,
  /** A placeholder entry: OCULTAR_BORRADORES=1 leaves it out of the Inicio and the menu. */
  borrador: z.literal(true).optional(),
});

export const destacadosFileSchema = z.strictObject({
  $schema: schemaRef,
  destacados: z.array(destacadoSchema).min(destacadosMin).max(destacadosMax),
});

/**
 * An entry of content/mundos.json: a world of the game, with the name the game shows, the same
 * in both locales. The Inicio lists the names (`WorldsTable`, §8.1); Comercio and Guild store
 * the `id` (§9.4, §10.13). There is no population: no source gives it (X3, PZ-05).
 */
export const mundoSchema = z.strictObject({
  id: slug,
  nombre: prose,
});

export const mundosFileSchema = z.strictObject({
  $schema: schemaRef,
  mundos: z.array(mundoSchema),
});

// ------------------------------------------------------------------ Cambios (§3.13, §8.7)
//
// `content/cambios.json`, mirrored from content/schemas/cambios.schema.json. The owner writes
// it by hand (R10, D-011). The pattern of `fecha` (a day of the calendar, leap days included)
// and the `tipo` list of a `Ref` are read from the JSON Schema, the one place that says them.
// What needs the whole file or other registries — a repeated id, an entity with no record, an
// entity named twice in one entry, a sprite missing from the registry, points that differ in
// number between the two languages, a game amount written as free text — is checked by
// `pnpm content:check`; the mirror keeps to the JSON Schema.

const { $defs: cambioDefs } = cambiosJsonSchema;

const cambioRefTipos = cambioDefs.ref.properties.tipo.enum as readonly ContentRef['tipo'][];

/** `Ref` of §3.13 in an entry: an entity with its own registry, drawn as a `NestedEntity`. */
const cambioRef = z.strictObject({
  tipo: z.custom<ContentRef['tipo']>(
    (value) => cambioRefTipos.includes(value as ContentRef['tipo']),
    { message: `Debe ser uno de: ${cambioRefTipos.join(', ')}.` },
  ),
  id: slug,
});

/**
 * An entry of content/cambios.json (§3.13): one step of the `Timeline` of its month on the
 * Cambios page (8.7). `fecha` is a day of the calendar, `AAAA-MM-DD`, not an instant: its month
 * is the section and the day the label of the step. `puntos` are the same points in both
 * languages, under the title; `entidades` the chips of the step; without `sprite` the node is
 * the fixed key `ui/cambios` (§3.13).
 */
export const cambioSchema = z.strictObject({
  id: slug,
  fecha: z.string().regex(new RegExp(cambioDefs.fecha.pattern, 'u')),
  titulo: texto,
  puntos: z.strictObject({ es: z.array(prose).min(1), en: z.array(prose).min(1) }).optional(),
  entidades: z.array(cambioRef).min(1).optional(),
  sprite: spriteKey.optional(),
  /** A placeholder entry: OCULTAR_BORRADORES=1 leaves it out of the page. */
  borrador: z.literal(true).optional(),
});

export const cambiosFileSchema = z.strictObject({
  $schema: schemaRef,
  cambios: z.array(cambioSchema),
});

export type Categoria = z.infer<typeof categoriaSchema>;
export type Item = z.infer<typeof itemSchema>;
/** `held` de un ítem con `categoria === "helds"` (§16.2.3). */
export type Held = z.infer<typeof heldSchema>;
/** `mega` de una Mega Stone (§16.2.3). */
export type Mega = z.infer<typeof megaSchema>;
/** `ball` of a Poké Ball. */
export type Ball = z.infer<typeof ballSchema>;
/** `obtencion` of an item. */
export type Obtencion = z.infer<typeof obtencionSchema>;
export type Addon = z.infer<typeof addonSchema>;
export type OutfitRecord = z.infer<typeof outfitSchema>;
export type AuraShader = (typeof auraShaders)[number];
export type Aura = z.infer<typeof auraSchema>;
export type Elemento = z.infer<typeof elementoSchema>;
/** One record of content/tiers.json (§16.2.1). */
export type TierRecord = z.infer<typeof tierSchema>;
export type SystemItem = z.infer<typeof systemItemSchema>;
/** `Texto` of §3.13. */
export type Texto = z.infer<typeof texto>;
/** `Ref` of §3.13. */
export type Ref = z.infer<typeof ref>;
export type EnLinea = z.infer<typeof enLineaSchema>;
export type TextoEnLinea = z.infer<typeof textoEnLineaSchema>;
export type Celda = z.infer<typeof celdaSchema>;
export type BloqueTipo = (typeof bloqueTipos)[number];
export type Bloque = z.infer<typeof bloqueSchema>;
/** The block of one type: `BloqueDe<'tabla'>`. */
export type BloqueDe<T extends BloqueTipo> = Extract<Bloque, { tipo: T }>;
export type Seccion = z.infer<typeof seccionSchema>;
export type Sistema = z.infer<typeof sistemaFileSchema>;
export type Destacado = z.infer<typeof destacadoSchema>;
export type Mundo = z.infer<typeof mundoSchema>;
export type Cambio = z.infer<typeof cambioSchema>;
