# Registros editables (D-011)

Guía para editar a mano los datos del juego que usa el sitio: categorías e items del Market, outfits y addons, auras, el registro de sprites, los destacados y los mundos del Inicio, los cambios, las actividades, y los datos de la Pokédex, movimientos, ubicaciones, rotaciones, objetos de sistemas y mapa.

## Dónde está cada cosa

| Archivo                          | Contiene                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| `content/items/categorias.json`  | Las 14 categorías del Market, en el orden del cliente               |
| `content/items/<categoria>.json` | Los items de una categoría (`stones.json`, `poke-balls.json`…)      |
| `content/outfits.json`           | El outfit de cada Pokémon y sus addons                              |
| `content/auras.json`             | Las auras de la vista previa de outfits                             |
| `content/destacados.json`        | Las páginas de «Destacados» del Inicio y del menú lateral           |
| `content/mundos.json`            | Los mundos del juego (tabla «Mundos» del Inicio)                    |
| `content/cambios.json`           | Los cambios del juego y de la wiki (página Cambios)                 |
| `content/comercio/`              | Anuncios y vendedores de ejemplo de Comercio: solo con `COMERCIO_DEMO=1`, nunca en producción |
| `public/sprites/`                | Las imágenes, en carpetas por tipo                                  |
| `public/sprites/sprites.json`    | El registro de sprites: qué imagen usa cada clave y cómo se recorta |
| `content/pokemon.json`           | Los 910 Pokémon y variantes de la Pokédex                           |
| `content/tiers.json`             | Los 12 tiers: nombre, orden, «Max brokes» y si el tier se muestra   |
| `content/elementos.json`         | Los 18 elementos: nombre en los dos idiomas, icono, Stone, Fragment |
| `content/moves.json`             | Movimientos                                                         |
| `content/quests.json`            | Actividades (misiones): una página por actividad                    |
| `content/locations.json`         | Ubicaciones                                                         |
| `content/rotations.json`         | Rotaciones y tiers                                                  |
| `content/system-items.json`      | Objetos que pertenecen a un sistema (por ejemplo, cargadores)       |
| `content/map/markers.json`       | Marcadores del minimapa                                             |
| `content/map/floors.json`        | Imagen y límites de cada piso del mapa                              |
| `content/schemas/`               | Los esquemas que validan cada archivo                               |

Cada archivo empieza con `"$schema"`. VS Code lo usa para autocompletar los campos, mostrar su descripción al pasar el cursor y subrayar los errores. Los esquemas no admiten campos que no conocen: un campo de más (por ejemplo `"fuente"`) es un error.

## Reglas comunes

- Las claves van en español; los nombres del juego, en inglés y tal como aparecen en el cliente.
- `id` es un slug: minúsculas, números y guiones (`fire-stone`). No lo cambies después de publicarlo.
- Lo que no sabes va como `null`. La web muestra «—». Nunca pongas `0` para decir «no sé».
- `"borrador": true` marca un registro de relleno. Se muestra por defecto. Para ocultar los borradores (items, addons, auras y outfits) en un build: `$env:OCULTAR_BORRADORES = '1'; pnpm build` en PowerShell, o la variable `OCULTAR_BORRADORES=1` en Vercel.
- Cuando el registro ya tiene los datos reales, borra la línea `"borrador": true` (o ponla en `false`).

## Glosario

- **Pokédólares** (en inglés, Pokédollars): el dinero del juego. Los jugadores lo cuentan en k (mil) y kk (millón): 150kk son 150,000,000. Su sprite es `ui/pokedolares`. Los valores de `precioNpc` son Pokédólares.

## Añadir un item

1. Abre el archivo de su categoría, por ejemplo `content/items/stones.json`.
2. Añade un objeto a la lista `items`:

```json
{
  "id": "moon-stone",
  "nombre": "Moon Stone",
  "clientId": null,
  "categoria": "stones",
  "sprite": "items/stones/moon-stone",
  "apilable": true,
  "precioNpc": { "vende": null, "compra": null }
}
```

- `categoria` debe coincidir con el nombre del archivo.
- `clientId` es el ID del item en el `.dat` del cliente; `null` si no lo sabes.
- `precioNpc.vende` y `precioNpc.compra` son enteros en Pokédólares; `null` si no los sabes.
- `apilable` es `true`, `false` o `null`.
- `sprite` es una clave de `public/sprites/sprites.json` (siguiente sección).

Las categorías no se añaden: son las del Market. «Todo» es virtual (`"virtual": true`) y reúne los items de las demás; no tiene archivo.

`content/schemas/categorias.schema.json` fija las 14 categorías y su orden, posición por posición. Si en `categorias.json` cambias el orden, borras una categoría o añades otra, `pnpm content:check` y el build fallan. Si el juego algún día cambia el Market:

1. Cambia la lista `prefixItems` de `content/schemas/categorias.schema.json` (`id`, `orden` y `virtual` de cada posición).
2. Cambia la lista `categoria` de `content/schemas/items.schema.json`: son las mismas categorías sin «todo», en el mismo orden. `pnpm content:check` avisa si no coinciden.
3. Cambia `content/items/categorias.json` y crea o borra el archivo `content/items/<categoria>.json`.

El código lee la lista de categorías del esquema; no hay que tocarlo.

### Held items y Mega Stones (§16.2.3)

Cada item de `content/items/helds.json` (`categoria: "helds"`) necesita `held`: en el juego cada tier de un efecto es su propio item (X-Attack T1, X-Attack T2…), así se puede filtrar y ordenar por tier.

```json
{
  "id": "x-attack-t1",
  "nombre": "X-Attack",
  "clientId": null,
  "categoria": "helds",
  "sprite": "items/helds/x-attack-t1",
  "apilable": true,
  "precioNpc": { "vende": null, "compra": null },
  "held": { "ranura": "x", "efecto": "X-Attack", "tier": 1 }
}
```

- `held.ranura` es `"x"` o `"y"`, la ranura del held en el juego.
- `held.efecto` es el nombre canónico del efecto, sin el tier (`"X-Attack"`, no `"X-Attack T1"`).
- `held.tier` es un entero de 1 a 8 (`HELD_TIER_MAX`). Sin `held`, `pnpm content:check` refusa el registro: es obligatorio para `categoria: "helds"`.
- Un item de **cualquier** categoría puede llevar `mega`, que lo marca como Mega Stone: `"mega": { "pokemon": ["charizard"] }`. `pokemon` son `id` de `content/pokemon.json`; deja `[]` si no sabes cuál Pokémon la usa. `pnpm content:check` comprueba que cada `id` exista.
- `src/lib/content/registry.ts` tiene `getHeldsBySlot("x" | "y")` (la matriz de `HeldPicker`) y `getMegaStones(pokemonId?)` (las Mega Stones de un Pokémon primero).

### Dónde se compran y en qué se usan los Diamonds

`content/items/diamantes.json` lleva, además de sus items, el objeto `moneda`: dónde se compran los Diamonds y en qué se usan, una lista por idioma. Son las filas «Se compran en» y «Se usan en» del panel de los Diamonds y de un anuncio de Diamonds en Comercio.

```json
"moneda": {
  "seCompranEn": null,
  "seUsanEn": null
}
```

- Cuando lo sepas, cada `null` pasa a `{ "es": [...], "en": [...] }`: los mismos lugares en los dos idiomas y en el mismo orden, los nombres del juego en inglés y sin importes del juego.
- Una lista en `null` o vacía no genera fila; sin ninguna fila, un importe de Diamonds no abre panel.
- Solo `diamantes.json` lleva `moneda`: `pnpm content:check` lo rechaza en otro archivo.

## Añadir un sprite

1. Copia el PNG en la carpeta de su tipo, por ejemplo `public/sprites/items/stones/moon-stone.png`.
2. Registra la clave en `public/sprites/sprites.json`:

```json
"items/stones/moon-stone": {
  "archivo": "items/stones/moon-stone.png",
  "frame": [32, 32],
  "frames": 1,
  "modo": "estatico"
}
```

- `archivo` es la ruta dentro de `public/sprites/`.
- `frame` es el tamaño de un frame en píxeles: `[ancho, alto]`.
- Una hoja (sheet) es una tira horizontal de frames del mismo tamaño. `frames` es cuántos tiene: el PNG mide `ancho × frames` por `alto`.

### Modos

| `modo`      | Uso                                     | Campos extra                     |
| ----------- | --------------------------------------- | -------------------------------- |
| `estatico`  | Un solo frame                           | `frames` es 1                    |
| `variante`  | Varios frames; el código elige cuál     | —                                |
| `cantidad`  | El frame depende de la cantidad apilada | `umbrales`                       |
| `animacion` | Los frames se reproducen en bucle       | `duracionMs` y, opcional, `loop` |

### Item con hoja de cantidad

La Alliance Ball tiene 8 frames: 1, 2, 3, 4, 5, 10, 25 y 100 unidades.

```json
"items/poke-balls/alliance-ball": {
  "archivo": "items/poke-balls/alliance-ball.png",
  "frame": [32, 32],
  "frames": 8,
  "modo": "cantidad",
  "umbrales": [1, 2, 3, 4, 5, 10, 25, 100]
}
```

`umbrales` lleva un número por frame, de menor a mayor: la cantidad mínima con la que se ve ese frame. Con 7 unidades se ve el frame de 5; con 30, el de 25.

### Item animado

El Diamond tiene 7 frames de 110 ms cada uno.

```json
"ui/diamond": {
  "archivo": "ui/diamond.png",
  "frame": [32, 32],
  "frames": 7,
  "modo": "animacion",
  "duracionMs": [110, 110, 110, 110, 110, 110, 110]
}
```

`duracionMs` lleva una duración por frame, así que cada frame puede durar distinto. Añade `"loop": false` para reproducirla una sola vez. Quien tenga activado «reducir movimiento» en su sistema ve el frame 0 quieto.

### Arte de relleno

Un sprite puede apuntar a una imagen de otro mientras no tengas la real; márcalo con `"borrador": true`. Cuando tengas la imagen, cópiala con su nombre, cambia `archivo` y quita `borrador`. Las claves `ui/categorias/<categoria>` (iconos de las categorías) y los items de ejemplo están así.

Comercio usa estas claves: `outfits/5`, `items/stones/fire-stone`, `ui/diamond` y `ui/pokedolares` en las pestañas «Pokémon», «Items», «Diamonds» y «Pokédólares», y `ui/comercio/item` para un item que no está en el registro. `ui/comercio/item` es un dibujo de relleno (`borrador`) hasta que vuelques el sprite real. Si en «Crear anuncio» escribes el nombre exacto de un item del Market, se ve su sprite; si es una hoja de cantidad, el frame de la cantidad escrita.

## Añadir el outfit de un Pokémon y sus addons

En `content/outfits.json`:

```json
{
  "pokemon": "bulbasaur",
  "outfitId": 2,
  "addons": [
    {
      "id": "bulbasaur-addon-1",
      "nombre": "Nombre del addon",
      "outfitId": 1005,
      "sprite": "outfits/1005",
      "borrador": true
    }
  ]
}
```

- `pokemon` es el `id` de `content/pokemon.json`.
- `outfitId` es el ID del outfit en el `.dat` del cliente. Su sprite es siempre `outfits/<outfitId>`.
- Los addons también son outfits: cada uno tiene su `outfitId` y su sprite `outfits/<outfitId>`.

Los sprites de outfits tienen un PNG por dirección en `public/sprites/outfits/<outfitId>/` (`norte.png`, `este.png`, `sur.png`, `oeste.png`):

```json
"outfits/2": {
  "archivo": "outfits/2/sur.png",
  "frame": [32, 32],
  "frames": 1,
  "modo": "estatico",
  "direcciones": {
    "norte": "outfits/2/norte.png",
    "este": "outfits/2/este.png",
    "sur": "outfits/2/sur.png",
    "oeste": "outfits/2/oeste.png"
  }
}
```

No hace falta escribirlos a mano: la herramienta de volcado los crea (ver abajo).

## Añadir un aura

En `content/auras.json`:

```json
{
  "id": "alliance",
  "nombre": "Alliance",
  "shader": "outfit_alliance",
  "icono": "ui/auras/alliance"
}
```

- `shader` es el shader del cliente que reproduce la vista previa: `outfit_alliance` o `outfit_rainbow`. Otro shader necesita código nuevo en `src/components/wiki/OutfitPreview.tsx`.
- `icono` es la clave del sprite del anillo del aura (§16.2.4, `AuraPicker`), en `ui/auras/<id>`.

Cada aura aparece como un botón en la vista previa de outfits de la Pokédex y como ranura de `AuraPicker` (§16.3.3, formulario de Comercio y filtros). Un aura con `"borrador": true` también aparece, salvo en un build con `OCULTAR_BORRADORES=1`.

Las siete auras del cliente ya están en `content/auras.json`: Premier, Alliance, Christmas 2024, Halloween 2025, Solo Leveling, Digimon Red Aura y Killua God Speed. El cliente no trae iconos de aura (se ven en el juego como un anillo con el sombreador del aura); mientras no llegue el icono real de cada una, usa el anillo genérico en `ui/auras/<id>` marcado `"borrador": true`. Para poner el icono real: sustituye el PNG en `public/sprites/ui/auras/<id>.png` (32×32) y quita `"borrador"` de esa aura en `content/auras.json`.

## Destacados y mundos del Inicio

`content/destacados.json` tiene de 1 a 4 páginas del sitio. El Inicio las muestra en «Destacados», la página Buscar las repite mientras no hay búsqueda y el menú lateral las fija en su grupo «Destacados», siempre en el orden del archivo:

```json
{
  "etiqueta": { "es": "Tier list", "en": "Tier list" },
  "ruta": "/pokedex/tiers/",
  "sprite": "ui/balls/ultra-ball"
}
```

- `ruta` es la dirección de la página sin el idioma y con barra final. Tiene que ser una página que el sitio ya publica, y dos entradas no pueden llevar a la misma. El Inicio, Buscar y el menú muestran siempre las mismas entradas.
- `sprite` es una clave de `sprites.json`, o `null` para dejar la caja vacía. En «Destacados» se dibuja a la mayor escala entera que no pasa de 32, y nunca por encima de 3x (un sprite de 16 a 2x, uno de 32 a 1x, uno de 8 a 3x); un sprite de más de 32 detiene el build. En el menú va a 1x, centrado en una caja de 16: el diseño pide ahí sprites de 16, y uno más grande sobresale de la caja. El Diamond (`ui/diamond`) gira en «Destacados» y en el menú queda quieto y a la mitad, la única reducción de un sprite.
- Con `"borrador": true`, la entrada no aparece en un build con `OCULTAR_BORRADORES=1`. Una entrada publicada no puede llevar a la página de un sistema en borrador, porque ese build no la escribe.
- Sin el archivo, el Inicio no muestra «Destacados» y el menú no tiene ese grupo.

`content/mundos.json` tiene los mundos del juego, con el nombre que muestra el cliente (el mismo en los dos idiomas):

```json
{ "id": "titan-1", "nombre": "Titan 1" }
```

- `id` en minúsculas y con guiones. No lo cambies después de publicarlo: Comercio y Guild guardarán ese `id`.
- El orden del archivo no importa: la tabla del Inicio ordena por nombre con los números en su orden («Titan 2» antes de «Titan 10»).
- La tabla solo tiene la columna «Mundo»: el sitio no conoce los jugadores en línea de cada mundo.
- Sin el archivo, o con la lista vacía, el Inicio no muestra la tabla.

## Cambios

`content/cambios.json` tiene los cambios del juego y de la wiki que lista la página Cambios (`/es/cambios/`). Se escribe a mano: el sitio no lee el changelog del launcher. Un cambio:

```json
{
  "id": "boost-bandas",
  "fecha": "2026-09-18",
  "titulo": { "es": "…", "en": "…" },
  "puntos": { "es": ["…", "…"], "en": ["…", "…"] },
  "entidades": [
    { "tipo": "sistema", "id": "boost" },
    { "tipo": "item", "id": "fire-stone" }
  ],
  "sprite": "ui/balls/alliance-ball"
}
```

- `id` en minúsculas y con guiones; no se repite entre cambios. `fecha` es el día del cambio, `AAAA-MM-DD`, y tiene que existir en el calendario (`2026-02-30` es un error).
- `titulo` va en los dos idiomas. `puntos` es opcional y lleva los mismos puntos en los dos idiomas, en el mismo orden.
- `entidades` es opcional: los Pokémon, ítems, páginas de sistema o actividades que toca el cambio, cada uno una vez. Cada `id` tiene que existir en su registro (`content/pokemon.json`, `content/items/`, `content/sistemas/` o `content/quests.json`). La página los muestra con su tooltip; una actividad se muestra solo con su nombre.
- `sprite` es opcional y es una clave de `sprites.json`; sin él, el paso usa `ui/cambios`, y mientras esa clave no está en `sprites.json`, el paso muestra la marca de sprite que falta.
- Los textos no llevan importes del juego («150kk», «20 Diamonds»): el sitio muestra cada importe con el sprite de su moneda, y un texto libre no puede.
- No hay campo de fuente ni de enlace: un cambio no dice de dónde sale.
- El orden del archivo no importa: la página agrupa por mes, del más reciente al más antiguo, y dentro del mes ordena por fecha y después por `id`.
- Con `"borrador": true`, el cambio no aparece en un build con `OCULTAR_BORRADORES=1`.
- Sin el archivo, o con la lista vacía, la página dice «Aún no hay cambios publicados.».

## Actividades

`content/quests.json` tiene las actividades del juego. Cada una tiene su página en `/es/actividades/<id>/`, su entrada en el índice `/es/actividades/`, en el grupo «Actividades» del menú y en el panel «Actividades» del Inicio.

- `nombre`, `npcs`, `lugares`, `pokemon` y `sistemas` son nombres del juego, en inglés y tal como los muestra el cliente, iguales en los dos idiomas.
- Los textos (`resumen`, `instrucciones` y cada punto de `requisitos`, `pasos`, `recompensas` y `notas`) van por idioma: `{ "es": "…", "en": "…" }`. Un texto que solo existe en inglés lleva solo `"en"`, y la página en español lo muestra en inglés, marcado como inglés; al traducirlo se añade `"es"`. Dentro de un texto, los nombres del juego (NPC, lugares, ítems, Pokémon) siguen en inglés en los dos idiomas.
- `sprite` es opcional: una clave de `sprites.json` para el índice, el panel «Actividades» del Inicio, la búsqueda y el recuadro de la página, o `null`. Sin él, la casilla queda vacía en el índice y el recuadro muestra la marca de sprite que falta.
- Las actividades no llevan `"borrador"`: cada registro del archivo es una página publicada.
- Los textos no llevan importes del juego en texto libre, por la misma razón que los cambios.
- `lugares`, `pokemon` y `sistemas` no se muestran en la página: son nombres sueltos, sin registro propio.

## Pokédex, movimientos y mapa

Estos archivos siguen las mismas reglas comunes; VS Code muestra qué va en cada campo.

- `content/pokemon.json`: `tier` es un número (1, 2, 3…) o una categoría especial (`"Super Rare"`, `"Ultra Rare"`, `"Legendary"`, `"Mythic"`, `"ULTIMATE"`); `variante` es `normal` o `shiny`; `funcion` es `PVE`, `PVP` o `null`; `elementos` lleva hasta dos tipos, en inglés y en minúsculas. Un valor nuevo del juego (otra variante o categoría de tier) se añade en `$defs` de `content/schemas/pokemon.schema.json`; el código lee las listas de ahí.
- `pnpm content:roster` actualiza `content/pokemon.json` desde la wiki del juego: añade los Pokémon nuevos y rellena lo que está en `null`, sin tocar lo que editaste. `--overwrite` reemplaza todos los campos importados y `--dry-run` solo muestra el resumen.
- `content/pokemon.json`, campos opcionales de la ficha: mientras falta uno, su fila o su sección no aparece.
  - `hp` y `experiencia`: enteros o `null`.
  - `drops`: `[{ "item": "fire-stone", "cantidad": { "min": 1, "max": 3 } }]`, en el orden en que se muestran; `item` es el `id` de un item de `content/items/` y cada item va una sola vez. `cantidad` es `null` si no se sabe; `max` no puede ser menor que `min`.
  - `evolucion`: las evoluciones que salen de este Pokémon, `[{ "a": "charmeleon", "nivel": 16, "items": [{ "item": "fire-stone", "cantidad": 1 }] }]`. `a` es el `id` del Pokémon al que evoluciona; la cadena no puede volver a un Pokémon anterior. La primera etapa es la que ningún registro nombra en `a`.
  - `habilidades`: nombres del juego, sin traducir (`["Fly", "Strength"]`).
  - `donde`: `{ "hunts": [], "linkedTasks": [], "equiposNpc": [] }`, cada lista de `{ "texto": "…" }`. Con `"ref": { "tipo": "pokemon" | "item" | "sistema" | "actividad", "id": "…" }` el texto abre el tooltip de esa entidad; la referencia tiene que existir.
  - `elementoMoveset`: `id` de un elemento o `null` (columna «Moveset» de la Tier list de la ficha, filtro «Tipo de moveset» de la Pokédex y de `PokemonPicker`, §16.2.2). Un valor escrito a mano no se pisa sin la orden del propietario: `pnpm content:roster` nunca lo toca solo.
- `content/elementos.json`: los 18 elementos en un orden fijo que el esquema comprueba. `icono` es una clave de `sprites.json` o `null` (el chip se muestra solo con el nombre); `stone` y `fragment` son `id` de items o `null`.
- `content/moves.json`: `pokemon` lleva ids de `content/pokemon.json`; `elemento` es el `id` del elemento (`"normal"`, `"fire"`…), no su nombre, o `null`. `alcance` (§16.2.2) es opcional: `"area"`, `"objetivo"` o `"pasivo"`, las etiquetas aoe / target / passive del Pokédex del juego, o `null` si no se conoce. El importador usa `alcance` para calcular `elementoMoveset`: cuenta primero los movimientos de área por elemento (gana el que más tiene); sin movimientos de área, cuenta todos los de daño; un empate lo gana el elemento que también sea uno de los tipos del Pokémon, o si no, el primero en el orden de movimientos del juego.

### Jerarquía de tiers (§16.2.1)

Del mejor al peor: **ULTIMATE, Mythic, Legendary, Ultra Rare, Super Rare, T1, T2, T3, T4, T5, T6, T7.** `$defs.tierEspecial` de `content/schemas/pokemon.schema.json` los guarda de menor a mayor (Super Rare → ULTIMATE); `src/lib/content/tier-rank.ts` (equipo UI) lee esa lista para `tierRank`, `compareTierRank` y el orden de la Tier list, del filtro «Tier» y de `PokemonPicker`. Un tier especial nuevo se añade solo en el `enum` de `tierEspecial`, en su posición en la jerarquía; el código no lo repite en ningún otro archivo.

### Registro de tiers (`content/tiers.json`, §16.2.1)

Un registro por tier, en el mismo orden de la jerarquía de arriba: `ultimate`, `mythic`, `legendary`, `ultra-rare`, `super-rare`, `t1`…`t7`. El esquema (`content/schemas/tiers.schema.json`) exige los 12, en ese orden exacto; no se añaden ni se quitan tiers desde este archivo — un tier nuevo del juego se añade primero en `$defs.tierEspecial` de `pokemon.schema.json` (arriba) y después aquí, en su posición.

- `id`, `nombre` y `orden` no se tocan: son los 12 fijos de la jerarquía. `nombre` es el nombre del juego tal cual (`"ULTIMATE"`, `"Mythic"`… `"T1"`), igual en los dos idiomas.
- `maxBrokes`: el máximo de brokes del tier, un entero. Se rellena a mano cuando se conoce el dato; mientras no se conoce va `null` (nunca `0`, que significaría «cero brokes»). Lo muestra la tira de filtros y el valor «Tier» de las Cards y de la Lista, en su tooltip («Max brokes: —» hasta que este campo tiene un número).
- `visible`: `false` saca el tier de la Tier list y de las opciones del filtro «Tier», sin tocar sus datos — los Pokémon de ese tier siguen existiendo y su ficha sigue mostrando su tier. Hoy solo `ultimate` está en `false`, porque ULTIMATE todavía no se usa en la Tier list. Para que ULTIMATE vuelva a aparecer, cambia su `"visible"` a `true`; no hace falta tocar ningún otro archivo.
- `pnpm content:check` exige que cada `tier` de `content/pokemon.json` tenga su registro aquí (el mismo id que calcula `tierKey` de `tier-rank.ts`); un tier sin registro es un error, no un borrador.

- `content/map/floors.json` lo escribe `node scripts/map/extract-otmm-preview.mjs <archivo .otmm>`. `ancho` y `alto` son el tamaño real de la imagen del piso.

## Comprobar los cambios

```powershell
pnpm content:check
```

Revisa todos los archivos y muestra un resumen por archivo con el número de registros y de borradores. Comprueba:

- que cada archivo de `content/` y `sprites.json` cumple su esquema y empieza con `"$schema"`;
- que los `id` no se repiten (en los marcadores, el número; en los pisos, `z`);
- que están las 14 categorías del Market en su orden, que cada categoría real tiene su archivo y que cada item está en el archivo de su categoría;
- que cada `sprite` e `icono` existe en `sprites.json`, y cada outfit tiene su `outfits/<outfitId>`;
- que cada imagen existe y mide exactamente `frame × frames`, y que la imagen de cada piso mide `ancho × alto`;
- que `umbrales` y `duracionMs` tienen un valor por frame y que los umbrales van de menor a mayor;
- que los Pokémon de `outfits.json` y `moves.json` existen en `content/pokemon.json`;
- que ningún Pokémon tiene el `id` `tiers` (es la dirección de la Tier list);
- que están los 12 tiers de `content/tiers.json`, en su orden fijo, y que el `tier` de cada Pokémon tiene su registro ahí;
- en `pokemon.json`: que cada item de `drops` y de `evolucion` existe y no se repite, que `cantidad.max` no es menor que `cantidad.min`, que cada `evolucion[].a` existe, que ninguna cadena de evolución es circular y que cada `ref` de `donde` existe;
- que cada elemento usado en `pokemon.json` y `moves.json` tiene nombre en los dos idiomas;
- en `destacados.json`: que cada `ruta` es una página que el sitio publica y no se repite, y que una entrada publicada no lleva a un sistema en borrador;
- en `mundos.json`: que ni `id` ni `nombre` se repiten;
- en `cambios.json`: que los `id` no se repiten, que cada entidad existe en su registro y no se repite en el mismo cambio, que cada `sprite` existe, que `puntos` tiene el mismo número de puntos en los dos idiomas y que ningún texto lleva un importe del juego;
- en `quests.json`: que cada `sprite` existe y que ningún texto lleva un importe del juego.

Si hay errores, dice el archivo, el campo y qué falla, y termina con código 1. Un error en un registro no oculta los demás: las otras comprobaciones siguen. Los avisos (por ejemplo, un PNG que ningún sprite usa) no lo detienen. `pnpm ci` lo ejecuta primero, y el build también falla si un archivo no cumple su esquema.

## Publicar outfits con la herramienta de volcado

La herramienta lee los archivos `things` que ya descifraste (sin modificarlos) y, con `--registrar`, copia al sitio los frames idle (fase 0) de las cuatro direcciones y actualiza `sprites.json`.

```powershell
# Un addon o cualquier outfit, por ID
pnpm assets:outfits -- --things "C:\ruta\a\data\things" --id 1005 --registrar

# Asignar el outfit de un Pokémon nuevo y publicarlo
pnpm assets:outfits -- --things "C:\ruta\a\data\things" --map pikachu=25 --slug pikachu --registrar

# Volver a publicar todos los Pokémon de content/outfits.json
pnpm assets:outfits -- --things "C:\ruta\a\data\things" --mapped --registrar
```

- `--map pokemon=id` añade o cambia el `outfitId` del Pokémon en `content/outfits.json`; nunca borra registros ni addons.
- `--registrar` escribe `public/sprites/outfits/<id>/` y la entrada `outfits/<id>`. Una entrada de relleno (`borrador`) se reemplaza por la real.
- `--dry-run` muestra qué haría sin escribir nada.
- Sin `--registrar` la herramienta no escribe en `public/`. Con `--registrar` acepta como máximo 50 outfits por ejecución y no acepta `--all`.

Después, ejecuta `pnpm content:check`. Los detalles de la herramienta están en `scripts/assets/README.md`.
