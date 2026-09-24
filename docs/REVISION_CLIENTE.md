# Revisión de los datos del cliente

Lista para comprobar en el juego lo que M14 añadió o cambió a partir del cliente descifrado por el propietario. Una fila por entidad y campo. Nada de este documento va a `content/` (D-012): allí solo están los valores.

- **Confirmado**: el dibujo o la tabla del cliente coincide exactamente con el tablero aprobado o con el registro.
- **Probable**: hay una pista fuerte, pero el cliente no trae el nombre o no hay coincidencia exacta. Esos registros llevan `"borrador": true`: con `OCULTAR_BORRADORES=1` no se publican.
- **Propuesta**: el cliente no tiene ese dato; se eligió un dibujo del juego que encaja.

`clientId` es el número del item en los archivos de objetos del cliente. Los precios, el uso y el elemento de los items siguen en `null`: el cliente no los trae.

## 1. Sprites fijos de la interfaz

Registro: `public/sprites/sprites.json`. Son las claves que el código nombra (§3.13).

|     | Entidad                 | Campo  | Valor                                                      | Qué es                                                                                                                                                                          | Estado                                                                                                               |
| --- | ----------------------- | ------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| ☐   | `ui/inicio`             | sprite | `ui/balls/alliance-ball.png`, 32 × 32                      | Alliance Ball (item 50422), junto al título del Inicio                                                                                                                          | Probable: el tablero dibuja un arte antiguo de la Alliance Ball que ya no está en el cliente; este es el arte actual |
| ☐   | `ui/indice/sistemas`    | sprite | `ui/indice/sistemas.png`, 32 × 32                          | Estrella «XP» (item 23312), cabecera del panel «Sistemas» del Inicio                                                                                                            | Confirmado                                                                                                           |
| ☐   | `ui/indice/items`       | sprite | `ui/indice/items.png`, 11 fases de 32 × 32, animación      | Item 49362, cabecera del panel «Ítems» del Inicio                                                                                                                               | Confirmado                                                                                                           |
| ☐   | `ui/indice/actividades` | sprite | `ui/indice/actividades.png`, 6 fases de 32 × 32, animación | Item 48196, cabecera del panel «Actividades» del Inicio                                                                                                                         | Confirmado                                                                                                           |
| ☐   | `ui/indice/pokedex`     | sprite | `outfits/2/sur.png`, 32 × 32                               | Bulbasaur (outfit 2) mirando al sur, cabecera del panel «Pokédex» del Inicio                                                                                                    | Confirmado                                                                                                           |
| ☐   | `ui/herramientas/guild` | sprite | `ui/herramientas/guild.png`, 28 × 28                       | Botón «Guild» de la barra superior del juego, en Herramientas                                                                                                                   | Probable: ningún tablero dibuja Herramientas                                                                         |
| ☐   | `ui/herramientas/mapa`  | sprite | `ui/herramientas/mapa.png`, 28 × 28                        | Botón del minimapa de la barra superior del juego, en Herramientas                                                                                                              | Probable: ningún tablero dibuja Herramientas                                                                         |
| ☐   | `ui/cambios`            | sprite | `ui/cambios.png`, 28 × 28                                  | Botón del calendario de la barra superior del juego, nodo de un cambio sin sprite propio                                                                                        | Propuesta: el juego no tiene lista de cambios                                                                        |
| ☐   | `ui/shiny`              | sprite | `ui/shiny.png`, 45 × 45                                    | Botón «Change Form» de la Pokédex del juego: pasa a la forma shiny y sale atenuado si el Pokémon no tiene forma shiny. Ninguna página lo usa todavía: es para el siguiente hito | Confirmado: el cliente lo usa en ese botón                                                                           |

## 2. Iconos de las categorías del Market

Registro: `public/sprites/sprites.json`. Sustituyen a los dibujos de relleno: la clave pierde `"borrador": true`. Las 14 categorías del cliente son las de `content/items/categorias.json`, en el mismo orden.

|     | Entidad                        | Campo  | Valor                                       | Qué es                                                      | Estado     |
| --- | ------------------------------ | ------ | ------------------------------------------- | ----------------------------------------------------------- | ---------- |
| ☐   | `ui/categorias/todo`           | sprite | `ui/categorias/todo.png`, 18 × 18           | Icono de la categoría «Todo» del Market del juego           | Confirmado |
| ☐   | `ui/categorias/diamantes`      | sprite | `ui/categorias/diamantes.png`, 22 × 20      | Icono de la categoría «Diamonds» del Market del juego       | Confirmado |
| ☐   | `ui/categorias/pokemon`        | sprite | `ui/categorias/pokemon.png`, 23 × 21        | Icono de la categoría «Pokémon» del Market del juego        | Confirmado |
| ☐   | `ui/categorias/poke-balls`     | sprite | `ui/categorias/poke-balls.png`, 18 × 17     | Icono de la categoría «Poké Balls» del Market del juego     | Confirmado |
| ☐   | `ui/categorias/stones`         | sprite | `ui/categorias/stones.png`, 23 × 24         | Icono de la categoría «Stones» del Market del juego         | Confirmado |
| ☐   | `ui/categorias/helds`          | sprite | `ui/categorias/helds.png`, 28 × 28          | Icono de la categoría «Helds» del Market del juego          | Confirmado |
| ☐   | `ui/categorias/orbs`           | sprite | `ui/categorias/orbs.png`, 18 × 17           | Icono de la categoría «Orbs» del Market del juego           | Confirmado |
| ☐   | `ui/categorias/creature-items` | sprite | `ui/categorias/creature-items.png`, 22 × 17 | Icono de la categoría «Creature Items» del Market del juego | Confirmado |
| ☐   | `ui/categorias/general-items`  | sprite | `ui/categorias/general-items.png`, 22 × 22  | Icono de la categoría «General Items» del Market del juego  | Confirmado |
| ☐   | `ui/categorias/utilities`      | sprite | `ui/categorias/utilities.png`, 16 × 22      | Icono de la categoría «Utilities» del Market del juego      | Confirmado |
| ☐   | `ui/categorias/addons`         | sprite | `ui/categorias/addons.png`, 22 × 24         | Icono de la categoría «Addons» del Market del juego         | Confirmado |
| ☐   | `ui/categorias/consumable`     | sprite | `ui/categorias/consumable.png`, 20 × 18     | Icono de la categoría «Consumable» del Market del juego     | Confirmado |
| ☐   | `ui/categorias/foods`          | sprite | `ui/categorias/foods.png`, 22 × 19          | Icono de la categoría «Foods» del Market del juego          | Confirmado |
| ☐   | `ui/categorias/furnitures`     | sprite | `ui/categorias/furnitures.png`, 21 × 21     | Icono de la categoría «Furnitures» del Market del juego     | Confirmado |

## 3. Elementos

Registro: `content/elementos.json`; los iconos, en `public/sprites/ui/elementos/`. El icono es la casilla de 24 × 24 del tipo en la Pokédex del juego (la misma imagen que usan las misiones diarias). Qué Stone y qué Fragment corresponden a cada elemento lo dice la tabla Elemento/Stone/Fragment del tablero Sistema-Boost, no el cliente.

|     | Entidad                | Campo    | Valor                                   | Qué es                                                                                           | Estado                         |
| --- | ---------------------- | -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| ☐   | Normal (`normal`)      | icono    | `ui/elementos/normal`, 24 × 24          | Icono del tipo Normal en la Pokédex del juego                                                    | Confirmado                     |
| ☐   | Normal (`normal`)      | stone    | `heart-stone` (Heart Stone)             | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Normal (`normal`)      | fragment | `normal-fragment` (Normal Fragment)     | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Fuego (`fire`)         | icono    | `ui/elementos/fire`, 24 × 24            | Icono del tipo Fire en la Pokédex del juego                                                      | Confirmado                     |
| ☐   | Fuego (`fire`)         | stone    | `fire-stone` (Fire Stone)               | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Fuego (`fire`)         | fragment | `fire-fragment` (Fire Fragment)         | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Agua (`water`)         | icono    | `ui/elementos/water`, 24 × 24           | Icono del tipo Water en la Pokédex del juego                                                     | Confirmado                     |
| ☐   | Agua (`water`)         | stone    | `water-stone` (Water Stone)             | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Agua (`water`)         | fragment | `water-fragment` (Water Fragment)       | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Planta (`grass`)       | icono    | `ui/elementos/grass`, 24 × 24           | Icono del tipo Grass en la Pokédex del juego                                                     | Confirmado                     |
| ☐   | Planta (`grass`)       | stone    | `leaf-stone` (Leaf Stone)               | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Planta (`grass`)       | fragment | `grass-fragment` (Grass Fragment)       | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Eléctrico (`electric`) | icono    | `ui/elementos/electric`, 24 × 24        | Icono del tipo Electric en la Pokédex del juego                                                  | Confirmado                     |
| ☐   | Eléctrico (`electric`) | stone    | `thunder-stone` (Thunder Stone)         | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Eléctrico (`electric`) | fragment | `electric-fragment` (Electric Fragment) | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Hielo (`ice`)          | icono    | `ui/elementos/ice`, 24 × 24             | Icono del tipo Ice en la Pokédex del juego                                                       | Confirmado                     |
| ☐   | Hielo (`ice`)          | stone    | `ice-stone` (Ice Stone)                 | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Hielo (`ice`)          | fragment | `ice-fragment` (Ice Fragment)           | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Lucha (`fighting`)     | icono    | `ui/elementos/fighting`, 24 × 24        | Icono del tipo Fighting en la Pokédex del juego                                                  | Confirmado                     |
| ☐   | Lucha (`fighting`)     | stone    | `punch-stone` (Punch Stone)             | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Lucha (`fighting`)     | fragment | `fighting-fragment` (Fighting Fragment) | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Veneno (`poison`)      | icono    | `ui/elementos/poison`, 24 × 24          | Icono del tipo Poison en la Pokédex del juego                                                    | Confirmado                     |
| ☐   | Veneno (`poison`)      | stone    | `venom-stone` (Venom Stone)             | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Veneno (`poison`)      | fragment | `poison-fragment` (Poison Fragment)     | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Tierra (`ground`)      | icono    | `ui/elementos/ground`, 24 × 24          | Icono del tipo Ground en la Pokédex del juego                                                    | Confirmado                     |
| ☐   | Tierra (`ground`)      | stone    | `earth-stone` (Earth Stone)             | El tablero nombra la Stone pero no la dibuja; se eligió el item del cliente cuyo color encaja    | Probable (el item es borrador) |
| ☐   | Tierra (`ground`)      | fragment | `ground-fragment` (Ground Fragment)     | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Volador (`flying`)     | icono    | `ui/elementos/flying`, 24 × 24          | Icono del tipo Flying en la Pokédex del juego                                                    | Confirmado                     |
| ☐   | Volador (`flying`)     | stone    | `feather-stone` (Feather Stone)         | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Volador (`flying`)     | fragment | `flying-fragment` (Flying Fragment)     | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Psíquico (`psychic`)   | icono    | `ui/elementos/psychic`, 24 × 24         | Icono del tipo Psychic en la Pokédex del juego                                                   | Confirmado                     |
| ☐   | Psíquico (`psychic`)   | stone    | `enigma-stone` (Enigma Stone)           | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Psíquico (`psychic`)   | fragment | `psychic-fragment` (Psychic Fragment)   | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Bicho (`bug`)          | icono    | `ui/elementos/bug`, 24 × 24             | Icono del tipo Bug en la Pokédex del juego                                                       | Confirmado                     |
| ☐   | Bicho (`bug`)          | stone    | `cocoon-stone` (Cocoon Stone)           | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Bicho (`bug`)          | fragment | `bug-fragment` (Bug Fragment)           | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Roca (`rock`)          | icono    | `ui/elementos/rock`, 24 × 24            | Icono del tipo Rock en la Pokédex del juego                                                      | Confirmado                     |
| ☐   | Roca (`rock`)          | stone    | `rock-stone` (Rock Stone)               | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Roca (`rock`)          | fragment | `rock-fragment` (Rock Fragment)         | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Fantasma (`ghost`)     | icono    | `ui/elementos/ghost`, 24 × 24           | Icono del tipo Ghost en la Pokédex del juego                                                     | Confirmado                     |
| ☐   | Fantasma (`ghost`)     | stone    | `ghost-stone` (Ghost Stone)             | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Fantasma (`ghost`)     | fragment | `ghost-fragment` (Ghost Fragment)       | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Dragón (`dragon`)      | icono    | `ui/elementos/dragon`, 24 × 24          | Icono del tipo Dragon en la Pokédex del juego                                                    | Confirmado                     |
| ☐   | Dragón (`dragon`)      | stone    | `crystal-stone` (Crystal Stone)         | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Dragón (`dragon`)      | fragment | `dragon-fragment` (Dragon Fragment)     | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Hada (`fairy`)         | icono    | `ui/elementos/fairy`, 24 × 24           | Icono del tipo Fairy en la Pokédex del juego; los tableros dibujaban para Hada el icono de steel | Confirmado                     |
| ☐   | Hada (`fairy`)         | stone    | `heart-stone` (Heart Stone)             | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Hada (`fairy`)         | fragment | `fairy-fragment` (Fairy Fragment)       | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Siniestro (`dark`)     | icono    | `ui/elementos/dark`, 24 × 24            | Icono del tipo Dark en la Pokédex del juego                                                      | Confirmado                     |
| ☐   | Siniestro (`dark`)     | stone    | `darkness-stone` (Darkness Stone)       | El tablero nombra la Stone pero no la dibuja; se eligió el item del cliente cuyo color encaja    | Probable (el item es borrador) |
| ☐   | Siniestro (`dark`)     | fragment | `dark-fragment` (Dark Fragment)         | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |
| ☐   | Acero (`steel`)        | icono    | `ui/elementos/steel`, 24 × 24           | Icono del tipo Steel en la Pokédex del juego                                                     | Confirmado                     |
| ☐   | Acero (`steel`)        | stone    | `metal-stone` (Metal Stone)             | Stone del elemento; el dibujo del tablero es el item del cliente                                 | Confirmado                     |
| ☐   | Acero (`steel`)        | fragment | `steel-fragment` (Steel Fragment)       | Fragment del elemento (nombre del tablero); ver la serie de Fragments en la sección 4            | Probable (el item es borrador) |

## 4. Stones y Fragments

Registro: `content/items/stones.json`; los sprites, en `public/sprites/items/stones/`. Cada Stone es un item animado de 8 fases (un brillo), apilable en el cliente.

### Stones que ya estaban

|     | Entidad                         | Campo    | Valor   | Qué es                                                                                   | Estado     |
| --- | ------------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------- | ---------- |
| ☐   | Fire Stone (`fire-stone`)       | clientId | 37853   | Número del item en el cliente; la hoja publicada coincide con sus 8 fases                | Confirmado |
| ☐   | Fire Stone (`fire-stone`)       | borrador | quitado | Nombre, sprite, clientId y apilable ya son datos del juego; los precios siguen en `null` | Confirmado |
| ☐   | Heart Stone (`heart-stone`)     | clientId | 37857   | Número del item en el cliente; la hoja publicada coincide con sus 8 fases                | Confirmado |
| ☐   | Heart Stone (`heart-stone`)     | borrador | quitado | Nombre, sprite, clientId y apilable ya son datos del juego; los precios siguen en `null` | Confirmado |
| ☐   | Leaf Stone (`leaf-stone`)       | clientId | 37855   | Número del item en el cliente; la hoja publicada coincide con sus 8 fases                | Confirmado |
| ☐   | Leaf Stone (`leaf-stone`)       | borrador | quitado | Nombre, sprite, clientId y apilable ya son datos del juego; los precios siguen en `null` | Confirmado |
| ☐   | Thunder Stone (`thunder-stone`) | clientId | 37856   | Número del item en el cliente; la hoja publicada coincide con sus 8 fases                | Confirmado |
| ☐   | Thunder Stone (`thunder-stone`) | borrador | quitado | Nombre, sprite, clientId y apilable ya son datos del juego; los precios siguen en `null` | Confirmado |
| ☐   | Water Stone (`water-stone`)     | clientId | 37854   | Número del item en el cliente; la hoja publicada coincide con sus 8 fases                | Confirmado |
| ☐   | Water Stone (`water-stone`)     | borrador | quitado | Nombre, sprite, clientId y apilable ya son datos del juego; los precios siguen en `null` | Confirmado |

### Stones nuevas

El nombre es el del tablero Sistema-Boost, que dibuja cada una con el mismo dibujo que el item del cliente. Earth Stone y Darkness Stone no tienen dibujo en el tablero: su item es el candidato por color y llevan `"borrador": true`.

|     | Entidad                           | Campo    | Valor                                                            | Qué es                                                   | Estado              |
| --- | --------------------------------- | -------- | ---------------------------------------------------------------- | -------------------------------------------------------- | ------------------- |
| ☐   | Ice Stone (`ice-stone`)           | sprite   | `items/stones/ice-stone.png`, 8 fases de 32 × 32, animación      | Item 37861 del cliente                                   | Confirmado          |
| ☐   | Ice Stone (`ice-stone`)           | clientId | 37861                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Ice Stone (`ice-stone`)           | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Punch Stone (`punch-stone`)       | sprite   | `items/stones/punch-stone.png`, 8 fases de 32 × 32, animación    | Item 37860 del cliente                                   | Confirmado          |
| ☐   | Punch Stone (`punch-stone`)       | clientId | 37860                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Punch Stone (`punch-stone`)       | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Venom Stone (`venom-stone`)       | sprite   | `items/stones/venom-stone.png`, 8 fases de 32 × 32, animación    | Item 37870 del cliente                                   | Confirmado          |
| ☐   | Venom Stone (`venom-stone`)       | clientId | 37870                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Venom Stone (`venom-stone`)       | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Earth Stone (`earth-stone`)       | sprite   | `items/stones/earth-stone.png`, 8 fases de 32 × 32, animación    | Candidato: item 37859, la única Stone marrón sin asignar | Probable (borrador) |
| ☐   | Earth Stone (`earth-stone`)       | clientId | 37859                                                            | Número del item en el cliente                            | Probable (borrador) |
| ☐   | Earth Stone (`earth-stone`)       | apilable | true                                                             | El cliente lo marca apilable                             | Probable (borrador) |
| ☐   | Feather Stone (`feather-stone`)   | sprite   | `items/stones/feather-stone.png`, 8 fases de 32 × 32, animación  | Item 37869 del cliente                                   | Confirmado          |
| ☐   | Feather Stone (`feather-stone`)   | clientId | 37869                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Feather Stone (`feather-stone`)   | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Enigma Stone (`enigma-stone`)     | sprite   | `items/stones/enigma-stone.png`, 8 fases de 32 × 32, animación   | Item 37862 del cliente                                   | Confirmado          |
| ☐   | Enigma Stone (`enigma-stone`)     | clientId | 37862                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Enigma Stone (`enigma-stone`)     | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Cocoon Stone (`cocoon-stone`)     | sprite   | `items/stones/cocoon-stone.png`, 8 fases de 32 × 32, animación   | Item 37866 del cliente                                   | Confirmado          |
| ☐   | Cocoon Stone (`cocoon-stone`)     | clientId | 37866                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Cocoon Stone (`cocoon-stone`)     | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Rock Stone (`rock-stone`)         | sprite   | `items/stones/rock-stone.png`, 8 fases de 32 × 32, animación     | Item 37858 del cliente                                   | Confirmado          |
| ☐   | Rock Stone (`rock-stone`)         | clientId | 37858                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Rock Stone (`rock-stone`)         | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Ghost Stone (`ghost-stone`)       | sprite   | `items/stones/ghost-stone.png`, 8 fases de 32 × 32, animación    | Item 37864 del cliente                                   | Confirmado          |
| ☐   | Ghost Stone (`ghost-stone`)       | clientId | 37864                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Ghost Stone (`ghost-stone`)       | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Crystal Stone (`crystal-stone`)   | sprite   | `items/stones/crystal-stone.png`, 8 fases de 32 × 32, animación  | Item 37867 del cliente                                   | Confirmado          |
| ☐   | Crystal Stone (`crystal-stone`)   | clientId | 37867                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Crystal Stone (`crystal-stone`)   | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |
| ☐   | Darkness Stone (`darkness-stone`) | sprite   | `items/stones/darkness-stone.png`, 8 fases de 32 × 32, animación | Candidato: item 37863, la forma de Ghost Stone en morado | Probable (borrador) |
| ☐   | Darkness Stone (`darkness-stone`) | clientId | 37863                                                            | Número del item en el cliente                            | Probable (borrador) |
| ☐   | Darkness Stone (`darkness-stone`) | apilable | true                                                             | El cliente lo marca apilable                             | Probable (borrador) |
| ☐   | Metal Stone (`metal-stone`)       | sprite   | `items/stones/metal-stone.png`, 8 fases de 32 × 32, animación    | Item 37868 del cliente                                   | Confirmado          |
| ☐   | Metal Stone (`metal-stone`)       | clientId | 37868                                                            | Número del item en el cliente                            | Confirmado          |
| ☐   | Metal Stone (`metal-stone`)       | apilable | true                                                             | El cliente lo marca apilable                             | Confirmado          |

### Fragments

Serie de 18 items del cliente con el mismo dibujo en 18 colores, numerados en orden alfabético del elemento en inglés (del 41695, bug, al 41712, water); el color medio coincide con el del elemento en 16 de 18. El cliente no trae sus nombres: los de aquí son los del tablero («Fire Fragment»…). Tampoco trae su categoría del Market: están en Stones de forma provisional. Basta con confirmar uno en el juego para validar la serie. Todos llevan `"borrador": true`.

|     | Entidad                                 | Campo     | Valor                                         | Qué es                           | Estado   |
| --- | --------------------------------------- | --------- | --------------------------------------------- | -------------------------------- | -------- |
| ☐   | Normal Fragment (`normal-fragment`)     | nombre    | Normal Fragment                               | Nombre provisional (tablero)     | Probable |
| ☐   | Normal Fragment (`normal-fragment`)     | clientId  | 41707                                         | Número del item en el cliente    | Probable |
| ☐   | Normal Fragment (`normal-fragment`)     | sprite    | `items/stones/normal-fragment.png`, 32 × 32   | Item 41707, estático             | Probable |
| ☐   | Normal Fragment (`normal-fragment`)     | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Normal Fragment (`normal-fragment`)     | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Fire Fragment (`fire-fragment`)         | nombre    | Fire Fragment                                 | Nombre provisional (tablero)     | Probable |
| ☐   | Fire Fragment (`fire-fragment`)         | clientId  | 41701                                         | Número del item en el cliente    | Probable |
| ☐   | Fire Fragment (`fire-fragment`)         | sprite    | `items/stones/fire-fragment.png`, 32 × 32     | Item 41701, estático             | Probable |
| ☐   | Fire Fragment (`fire-fragment`)         | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Fire Fragment (`fire-fragment`)         | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Water Fragment (`water-fragment`)       | nombre    | Water Fragment                                | Nombre provisional (tablero)     | Probable |
| ☐   | Water Fragment (`water-fragment`)       | clientId  | 41712                                         | Número del item en el cliente    | Probable |
| ☐   | Water Fragment (`water-fragment`)       | sprite    | `items/stones/water-fragment.png`, 32 × 32    | Item 41712, estático             | Probable |
| ☐   | Water Fragment (`water-fragment`)       | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Water Fragment (`water-fragment`)       | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Grass Fragment (`grass-fragment`)       | nombre    | Grass Fragment                                | Nombre provisional (tablero)     | Probable |
| ☐   | Grass Fragment (`grass-fragment`)       | clientId  | 41704                                         | Número del item en el cliente    | Probable |
| ☐   | Grass Fragment (`grass-fragment`)       | sprite    | `items/stones/grass-fragment.png`, 32 × 32    | Item 41704, estático             | Probable |
| ☐   | Grass Fragment (`grass-fragment`)       | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Grass Fragment (`grass-fragment`)       | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Electric Fragment (`electric-fragment`) | nombre    | Electric Fragment                             | Nombre provisional (tablero)     | Probable |
| ☐   | Electric Fragment (`electric-fragment`) | clientId  | 41698                                         | Número del item en el cliente    | Probable |
| ☐   | Electric Fragment (`electric-fragment`) | sprite    | `items/stones/electric-fragment.png`, 32 × 32 | Item 41698, estático             | Probable |
| ☐   | Electric Fragment (`electric-fragment`) | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Electric Fragment (`electric-fragment`) | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Ice Fragment (`ice-fragment`)           | nombre    | Ice Fragment                                  | Nombre provisional (tablero)     | Probable |
| ☐   | Ice Fragment (`ice-fragment`)           | clientId  | 41706                                         | Número del item en el cliente    | Probable |
| ☐   | Ice Fragment (`ice-fragment`)           | sprite    | `items/stones/ice-fragment.png`, 32 × 32      | Item 41706, estático             | Probable |
| ☐   | Ice Fragment (`ice-fragment`)           | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Ice Fragment (`ice-fragment`)           | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Fighting Fragment (`fighting-fragment`) | nombre    | Fighting Fragment                             | Nombre provisional (tablero)     | Probable |
| ☐   | Fighting Fragment (`fighting-fragment`) | clientId  | 41700                                         | Número del item en el cliente    | Probable |
| ☐   | Fighting Fragment (`fighting-fragment`) | sprite    | `items/stones/fighting-fragment.png`, 32 × 32 | Item 41700, estático             | Probable |
| ☐   | Fighting Fragment (`fighting-fragment`) | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Fighting Fragment (`fighting-fragment`) | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Poison Fragment (`poison-fragment`)     | nombre    | Poison Fragment                               | Nombre provisional (tablero)     | Probable |
| ☐   | Poison Fragment (`poison-fragment`)     | clientId  | 41708                                         | Número del item en el cliente    | Probable |
| ☐   | Poison Fragment (`poison-fragment`)     | sprite    | `items/stones/poison-fragment.png`, 32 × 32   | Item 41708, estático             | Probable |
| ☐   | Poison Fragment (`poison-fragment`)     | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Poison Fragment (`poison-fragment`)     | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Ground Fragment (`ground-fragment`)     | nombre    | Ground Fragment                               | Nombre provisional (tablero)     | Probable |
| ☐   | Ground Fragment (`ground-fragment`)     | clientId  | 41705                                         | Número del item en el cliente    | Probable |
| ☐   | Ground Fragment (`ground-fragment`)     | sprite    | `items/stones/ground-fragment.png`, 32 × 32   | Item 41705, estático             | Probable |
| ☐   | Ground Fragment (`ground-fragment`)     | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Ground Fragment (`ground-fragment`)     | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Flying Fragment (`flying-fragment`)     | nombre    | Flying Fragment                               | Nombre provisional (tablero)     | Probable |
| ☐   | Flying Fragment (`flying-fragment`)     | clientId  | 41702                                         | Número del item en el cliente    | Probable |
| ☐   | Flying Fragment (`flying-fragment`)     | sprite    | `items/stones/flying-fragment.png`, 32 × 32   | Item 41702, estático             | Probable |
| ☐   | Flying Fragment (`flying-fragment`)     | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Flying Fragment (`flying-fragment`)     | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Psychic Fragment (`psychic-fragment`)   | nombre    | Psychic Fragment                              | Nombre provisional (tablero)     | Probable |
| ☐   | Psychic Fragment (`psychic-fragment`)   | clientId  | 41709                                         | Número del item en el cliente    | Probable |
| ☐   | Psychic Fragment (`psychic-fragment`)   | sprite    | `items/stones/psychic-fragment.png`, 32 × 32  | Item 41709, estático             | Probable |
| ☐   | Psychic Fragment (`psychic-fragment`)   | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Psychic Fragment (`psychic-fragment`)   | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Bug Fragment (`bug-fragment`)           | nombre    | Bug Fragment                                  | Nombre provisional (tablero)     | Probable |
| ☐   | Bug Fragment (`bug-fragment`)           | clientId  | 41695                                         | Número del item en el cliente    | Probable |
| ☐   | Bug Fragment (`bug-fragment`)           | sprite    | `items/stones/bug-fragment.png`, 32 × 32      | Item 41695, estático             | Probable |
| ☐   | Bug Fragment (`bug-fragment`)           | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Bug Fragment (`bug-fragment`)           | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Rock Fragment (`rock-fragment`)         | nombre    | Rock Fragment                                 | Nombre provisional (tablero)     | Probable |
| ☐   | Rock Fragment (`rock-fragment`)         | clientId  | 41710                                         | Número del item en el cliente    | Probable |
| ☐   | Rock Fragment (`rock-fragment`)         | sprite    | `items/stones/rock-fragment.png`, 32 × 32     | Item 41710, estático             | Probable |
| ☐   | Rock Fragment (`rock-fragment`)         | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Rock Fragment (`rock-fragment`)         | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Ghost Fragment (`ghost-fragment`)       | nombre    | Ghost Fragment                                | Nombre provisional (tablero)     | Probable |
| ☐   | Ghost Fragment (`ghost-fragment`)       | clientId  | 41703                                         | Número del item en el cliente    | Probable |
| ☐   | Ghost Fragment (`ghost-fragment`)       | sprite    | `items/stones/ghost-fragment.png`, 32 × 32    | Item 41703, estático             | Probable |
| ☐   | Ghost Fragment (`ghost-fragment`)       | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Ghost Fragment (`ghost-fragment`)       | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Dragon Fragment (`dragon-fragment`)     | nombre    | Dragon Fragment                               | Nombre provisional (tablero)     | Probable |
| ☐   | Dragon Fragment (`dragon-fragment`)     | clientId  | 41697                                         | Número del item en el cliente    | Probable |
| ☐   | Dragon Fragment (`dragon-fragment`)     | sprite    | `items/stones/dragon-fragment.png`, 32 × 32   | Item 41697, estático             | Probable |
| ☐   | Dragon Fragment (`dragon-fragment`)     | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Dragon Fragment (`dragon-fragment`)     | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Fairy Fragment (`fairy-fragment`)       | nombre    | Fairy Fragment                                | Nombre provisional (tablero)     | Probable |
| ☐   | Fairy Fragment (`fairy-fragment`)       | clientId  | 41699                                         | Número del item en el cliente    | Probable |
| ☐   | Fairy Fragment (`fairy-fragment`)       | sprite    | `items/stones/fairy-fragment.png`, 32 × 32    | Item 41699, estático             | Probable |
| ☐   | Fairy Fragment (`fairy-fragment`)       | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Fairy Fragment (`fairy-fragment`)       | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Dark Fragment (`dark-fragment`)         | nombre    | Dark Fragment                                 | Nombre provisional (tablero)     | Probable |
| ☐   | Dark Fragment (`dark-fragment`)         | clientId  | 41696                                         | Número del item en el cliente    | Probable |
| ☐   | Dark Fragment (`dark-fragment`)         | sprite    | `items/stones/dark-fragment.png`, 32 × 32     | Item 41696, estático             | Probable |
| ☐   | Dark Fragment (`dark-fragment`)         | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Dark Fragment (`dark-fragment`)         | categoria | stones                                        | Categoría del Market provisional | Probable |
| ☐   | Steel Fragment (`steel-fragment`)       | nombre    | Steel Fragment                                | Nombre provisional (tablero)     | Probable |
| ☐   | Steel Fragment (`steel-fragment`)       | clientId  | 41711                                         | Número del item en el cliente    | Probable |
| ☐   | Steel Fragment (`steel-fragment`)       | sprite    | `items/stones/steel-fragment.png`, 32 × 32    | Item 41711, estático             | Probable |
| ☐   | Steel Fragment (`steel-fragment`)       | apilable  | true                                          | El cliente lo marca apilable     | Probable |
| ☐   | Steel Fragment (`steel-fragment`)       | categoria | stones                                        | Categoría del Market provisional | Probable |

## 5. Poké Balls

Registro: `content/items/poke-balls.json`; los iconos nuevos, en `public/sprites/items/poke-balls/`. La lista y los nombres son los 18 tipos de ball de la ventana de balls rotas del juego, en su orden; los iconos nuevos son los de esa ventana. El cliente no dice su número de item: `clientId` y `apilable` quedan en `null`.

|     | Entidad                         | Campo    | Valor                                        | Qué es                                                                                | Estado     |
| --- | ------------------------------- | -------- | -------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| ☐   | Poké Ball (`poke-ball`)         | nombre   | Poké Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Poké Ball (`poke-ball`)         | sprite   | `items/poke-balls/poke-ball.png`, 20 × 20    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Great Ball (`great-ball`)       | nombre   | Great Ball                                   | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Great Ball (`great-ball`)       | sprite   | `items/poke-balls/great-ball.png`, 20 × 20   | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Super Ball (`super-ball`)       | nombre   | Super Ball                                   | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Super Ball (`super-ball`)       | sprite   | `items/poke-balls/super-ball.png`, 21 × 21   | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Ultra Ball (`ultra-ball`)       | borrador | quitado                                      | El nombre está en la lista de balls del juego; el sprite ya era el dibujo del cliente | Confirmado |
| ☐   | Safari Ball (`safari-ball`)     | nombre   | Safari Ball                                  | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Safari Ball (`safari-ball`)     | sprite   | `items/poke-balls/safari-ball.png`, 20 × 20  | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Moon Ball (`moon-ball`)         | nombre   | Moon Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Moon Ball (`moon-ball`)         | sprite   | `items/poke-balls/moon-ball.png`, 20 × 20    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Tinker Ball (`tinker-ball`)     | nombre   | Tinker Ball                                  | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Tinker Ball (`tinker-ball`)     | sprite   | `items/poke-balls/tinker-ball.png`, 21 × 20  | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Yume Ball (`yume-ball`)         | nombre   | Yume Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Yume Ball (`yume-ball`)         | sprite   | `items/poke-balls/yume-ball.png`, 20 × 20    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Dusk Ball (`dusk-ball`)         | nombre   | Dusk Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Dusk Ball (`dusk-ball`)         | sprite   | `items/poke-balls/dusk-ball.png`, 20 × 20    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Heavy Ball (`heavy-ball`)       | nombre   | Heavy Ball                                   | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Heavy Ball (`heavy-ball`)       | sprite   | `items/poke-balls/heavy-ball.png`, 20 × 20   | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Janguru Ball (`janguru-ball`)   | nombre   | Janguru Ball                                 | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Janguru Ball (`janguru-ball`)   | sprite   | `items/poke-balls/janguru-ball.png`, 20 × 20 | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Magu Ball (`magu-ball`)         | nombre   | Magu Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Magu Ball (`magu-ball`)         | sprite   | `items/poke-balls/magu-ball.png`, 21 × 21    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Net Ball (`net-ball`)           | nombre   | Net Ball                                     | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Net Ball (`net-ball`)           | sprite   | `items/poke-balls/net-ball.png`, 21 × 21     | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Sora Ball (`sora-ball`)         | nombre   | Sora Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Sora Ball (`sora-ball`)         | sprite   | `items/poke-balls/sora-ball.png`, 20 × 20    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Tale Ball (`tale-ball`)         | nombre   | Tale Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Tale Ball (`tale-ball`)         | sprite   | `items/poke-balls/tale-ball.png`, 20 × 20    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Fast Ball (`fast-ball`)         | nombre   | Fast Ball                                    | Nombre en la ventana de balls rotas del juego                                         | Confirmado |
| ☐   | Fast Ball (`fast-ball`)         | sprite   | `items/poke-balls/fast-ball.png`, 20 × 20    | Icono de esa ball en la misma ventana                                                 | Confirmado |
| ☐   | Premier Ball (`premier-ball`)   | borrador | quitado                                      | El nombre está en la lista de balls del juego; el sprite ya era el dibujo del cliente | Confirmado |
| ☐   | Alliance Ball (`alliance-ball`) | borrador | quitado                                      | El nombre está en la lista de balls del juego; el sprite ya era el dibujo del cliente | Confirmado |

## 6. Modo de las hojas de sprites

Registro: `public/sprites/sprites.json`. En el cliente, las fases de las Stones y de la Premier y la Ultra Ball son una animación (un brillo), no dibujos por cantidad ni variantes. La Alliance Ball sí tiene 8 dibujos por cantidad y no cambia.

|     | Entidad                         | Campo      | Valor                                         | Qué es                                                                        | Estado                                       |
| --- | ------------------------------- | ---------- | --------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| ☐   | `items/stones/fire-stone`       | modo       | cantidad → animación (se quitan los umbrales) | Las 8 fases del item 37853                                                    | Confirmado                                   |
| ☐   | `items/stones/heart-stone`      | modo       | cantidad → animación (se quitan los umbrales) | Las 8 fases del item 37857                                                    | Confirmado                                   |
| ☐   | `items/stones/leaf-stone`       | modo       | cantidad → animación (se quitan los umbrales) | Las 8 fases del item 37855                                                    | Confirmado                                   |
| ☐   | `items/stones/thunder-stone`    | modo       | cantidad → animación (se quitan los umbrales) | Las 8 fases del item 37856                                                    | Confirmado                                   |
| ☐   | `items/stones/water-stone`      | modo       | cantidad → animación (se quitan los umbrales) | Las 8 fases del item 37854                                                    | Confirmado                                   |
| ☐   | `items/poke-balls/premier-ball` | modo       | variante → animación                          | Las 5 fases del item 50457                                                    | Confirmado                                   |
| ☐   | `items/poke-balls/ultra-ball`   | modo       | variante → animación                          | Las 5 fases del item 50456                                                    | Confirmado                                   |
| ☐   | Todas las animaciones nuevas    | duracionMs | 110 ms por fase                               | El cliente no guarda la duración de las fases; es la misma que usa el Diamond | Probable: comprobar la velocidad en el juego |

## 7. Sistemas

Registro: `content/sistemas/<id>.json`. El sprite es el que dibuja el tablero Main en el panel «Sistemas». El título en español es el de los textos en español del propio juego.

|     | Entidad              | Campo     | Valor                                                                                     | Qué es                                                                                                                     | Estado               |
| --- | -------------------- | --------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| ☐   | Boost                | sprite    | `ui/sistemas/boost`: `ui/sistemas/boost.png`, 9 fases de 32 × 32, animación               | Enhanced Normal Stone (item 42016), la Boost Stone del ejemplo del tablero Sistema-Boost                                   | Confirmado           |
| ☐   | Achievements         | sprite    | `ui/sistemas/achievements`: `ui/sistemas/achievements.png`, 32 × 32                       | Item 3156. El cliente trae además un icono de trofeo para Logros                                                           | Confirmado           |
| ☐   | Achievements         | titulo.es | Logros                                                                                    | Traducción del juego de «Achievements»                                                                                     | Confirmado           |
| ☐   | Experience and Level | sprite    | `ui/sistemas/experience`: `ui/indice/sistemas.png`, 32 × 32                               | Estrella «XP» (item 23312)                                                                                                 | Confirmado           |
| ☐   | Experience and Level | titulo.es | Experiencia y Nivel                                                                       | Traducciones del juego de «Experience» y «Level»                                                                           | Confirmado           |
| ☐   | GamePass             | sprite    | `ui/sistemas/gamepass`: `ui/sistemas/gamepass.png`, 32 × 32                               | Item 15662. El juego tiene además su botón de Game Pass en la barra superior                                               | Confirmado           |
| ☐   | GamePass             | titulo.es | Pase de Juego                                                                             | Traducción del juego de «Game Pass»                                                                                        | Confirmado           |
| ☐   | Linked Tasks         | sprite    | `ui/sistemas/linked-tasks`: `ui/sistemas/linked-tasks.png`, 8 fases de 32 × 32, animación | Item 48961. El juego tiene además su botón de Linked Tasks en la barra superior                                            | Confirmado           |
| ☐   | Linked Tasks         | titulo.es | Tareas Vinculadas                                                                         | Traducción del juego de «Linked Tasks»                                                                                     | Confirmado           |
| ☐   | Medal System         | sprite    | `ui/sistemas/medals`: `ui/indice/actividades.png`, 6 fases de 32 × 32, animación          | Item 48196, el mismo de la cabecera «Actividades». El cliente trae además un icono de medalla                              | Confirmado           |
| ☐   | Medal System         | titulo.es | Medallas                                                                                  | Traducción del juego de «Medals»                                                                                           | Confirmado           |
| ☐   | Prey                 | sprite    | `outfits/2`                                                                               | Bulbasaur, como lo dibuja el tablero. Parece un relleno: el juego tiene su botón de Prey en la barra superior              | Confirmado (tablero) |
| ☐   | Star Machine         | sprite    | `ui/diamond`                                                                              | El Diamond, como lo dibuja el tablero. Parece un relleno: el cliente trae una estrella de 16 × 16 del sistema de estrellas | Confirmado (tablero) |

Sin cambios: Held Items (el tablero no le dibuja sprite; «Held Items» no está en los textos en español del juego), Entrenamiento (el cliente no tiene icono) y los títulos de Prey, Star Machine y Boost, que el juego no traduce.

## 8. Actividad y Destacados

|     | Entidad                                           | Campo  | Valor                                                                                           | Qué es                                                                                                      | Estado     |
| --- | ------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| ☐   | Porygon Quest: Dr. Vektor (`content/quests.json`) | sprite | `ui/actividades/porygon-quest-dr-vektor`: `ui/actividades/porygon-quest-dr-vektor.png`, 32 × 32 | Item 15654, el que dibujan el tablero Main y el banner de Componentes                                       | Confirmado |
| ☐   | Linked Tasks (`content/destacados.json`)          | sprite | `ui/sistemas/linked-tasks`                                                                      | El mismo item 48961 del sistema; al ser una animación, se mueve en «Destacados» del Inicio, como el Diamond | Confirmado |

## 9. Pendiente de decidir

|     | Entidad                                  | Campo              | Valor posible                                                                        | Estado                                                                                                                     |
| --- | ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| ☐   | Alliance Ball, Premier Ball, Ultra Ball  | clientId           | 45310, 50457 y 50456 (los items cuyas fases son las hojas publicadas); son apilables | Probable: no aplicado. Los iconos estáticos 50422, 50409 y 50408 son otros items y el cliente no dice cuál vende el Market |
| ☐   | Diamond (`content/items/diamantes.json`) | clientId, apilable | 3028, true                                                                           | Confirmado: no aplicado, ese archivo es de otra pista de M14                                                               |
| ☐   | Held Items                               | sprite             | El icono de la categoría Helds del Market                                            | Propuesta: no aplicada                                                                                                     |
