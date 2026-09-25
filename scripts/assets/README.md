# Herramientas de assets del cliente: outfits

Scripts para sacar sprites y datos de outfits de los archivos `things` (`.dat` / `.spr`) del cliente de PokeAlliance **ya descifrados por el propietario**, para cuando quieras implementar outfits en Alliance Codex.

| Script                                     | Para qué sirve                                                                                                                                                                          | Dónde escribe                                                                                                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dump-outfits.mjs` (`pnpm assets:outfits`) | Volcar todos los outfits o los que elijas: frames PNG, hojas de sprites y datos (`outfit.json`). Con `--registrar`, publica además en el sitio los frames idle de los outfits elegidos. | Carpeta privada `research-inbox/client-files/outfits-dump` (ignorada por Git) o `--out`. Con `--registrar`, también `public/sprites/outfits/<id>/` y `public/sprites/sprites.json`. |
| `extract-outfit-preview.mjs`               | Regenerar los sprites del sitio (fase 0, cuatro direcciones) de todos los Pokémon y addons de `content/outfits.json` que no son borrador.                                               | `public/sprites/outfits/<id>/` y `public/sprites/sprites.json`                                                                                                                      |
| `lib/otclient-things.mjs`                  | Lector de DAT/SPR/OTML/OTFI, compositor de frames y codificador PNG compartidos.                                                                                                        | No escribe.                                                                                                                                                                         |
| `lib/sprite-registry.mjs`                  | Render de los frames idle y actualización de `sprites.json`, compartidos por `--registrar` y `extract-outfit-preview.mjs`.                                                              | `public/sprites/` (solo cuando lo llama uno de los dos).                                                                                                                            |

## Sprites de items y Pokémon: `extract-game-sprites.mjs`

Pone el sprite real del juego a cada item y a cada Pokémon del sitio. Se vuelve a ejecutar después de cada actualización del cliente.

```powershell
$cliente = "C:\Users\jalom\Documents\pka_datamine\decrypted\2026-09-23_17-38-39"
$datamine = "C:\Users\jalom\AppData\Roaming\PokeAlliance\PokeAllianceV3\datamine"
node scripts/assets/extract-game-sprites.mjs --client $cliente --datamine $datamine --dry-run
node scripts/assets/extract-game-sprites.mjs --client $cliente --datamine $datamine
python scripts/assets/pokemon-thumbs.py "$cliente\data\images\pokemons"   # si dice que hay retratos nuevos
pnpm content:check
```

- **Items**: cada item de `content/items/*.json` con `clientId` y un sprite de relleno (`ui/comercio/item` o un sprite `borrador`) pasa a `items/cliente/<clientId>` (`public/sprites/items/cliente/<clientId>.png`): el item tal como lo dibuja el inventario (patrón 0, es decir, el de una sola unidad si es apilable; todas las capas; el cuadrado visible `exactSize`). Si el item tiene más de una fase, el cliente lo anima: el archivo es la tira de sus fases con `modo: animacion` y `ITEM_PHASE_MS` (110 ms) por fase, porque este DAT no guarda duraciones (`frame-durations: false`); si no, su único frame. Un sprite que pusiste tú no se toca.
- **Copias** (`--solo copias`): las claves de `ITEM_COPIES` (`ui/diamond`, `ui/categorias/helds`, `ui/indice/items`, `ui/indice/actividades`, `ui/sistemas/boost`) son copias de un item animado del cliente; se vuelven a sacar de ese item como tira animada, recortada a la ventana que registran, con la misma clave, archivo y tamaño de frame.
- **Pokémon**: cada Pokémon sin registro en `content/outfits.json` recibe el `lookType` de la exportación (cyclopedia y, para las formas que no lista, el que dan las demás exportaciones con el mismo nombre; y la tabla `VERIFIED_OUTFITS` del script, comprobada a ojo contra el retrato del cliente). Su frame sur se registra como `outfits/<id>` con un solo archivo, `outfits/<id>/sur.png`. Si el cliente lo anima estando quieto (`animateAlways`), el archivo es la tira de sus fases con `modo: animacion` y 1000/fases ms por frame. Un outfit que registraste con sus cuatro direcciones se queda como está. Un shiny cuya única fuente es el outfit de su forma normal se queda sin outfit.
- **Apilable**: un item con `clientId` y `apilable: null` toma el atributo `stackable` de su item del DAT. Un valor que escribiste no se toca.
- **Balls** (`--solo balls`): cada item cuyo `sprite` es `items/poke-balls/<id>` y tiene `clientId` se vuelve a sacar del DAT con la misma clave. Si el item se apila con patrones de 4 × 2, es la tira de sus 8 dibujos de pila (`modo: cantidad`, `umbrales` 1, 2, 3, 4, 5, 10, 25, 50, los de `Item::calculatePatterns` de OTClient). Si no, su frame de inventario.
- **Retratos**: un Pokémon con `imagen: null` recibe el retrato de `data/images/pokemons` (`NNN.png`, `NNN.1.png` si es shiny, y las formas de `FORM_PORTRAITS`) cuando ningún otro registro lo usa.
- Al volver a ejecutarlo, regenera los sprites que son suyos (`items/cliente/*` y las entradas `outfits/<id>` de un archivo) y retira los que ya nadie usa. Solo escribe en `public/sprites/` y `content/`; nunca en el cliente, y rechaza archivos `PKA1`.
- Las listas no repiten el sprite completo: `datos.json` y las props llevan solo el `clientId` de un sprite `items/cliente/*` de 32 × 32 quieto (`3070`) y `"<clientId>x<fases>"` de uno animado (`"3028x22"`) (`listItemSprite` / `expandListSprite`, §13.6).
- Versión de contenido: cada `<img>` de un archivo de `public/sprites/` lleva `?v=<8 hex>` y cada una de `public/pokemon/` el suyo, el SHA-256 de los bytes de toda la carpeta que `astro.config.mjs` calcula en cada build (`scripts/lib/asset-versions.mjs`, `src/lib/assets/version.ts`). Un sprite que cambia con el mismo nombre (`ui/diamond` pasó de 7 a 22 frames) es otra URL, y ningún navegador o CDN dibuja la copia vieja con los frames nuevos; `public/pokemon/` se sirve `immutable` (`vercel.json`), así que sin la versión un retrato cambiado nunca se refrescaría. La versión la ponen los componentes que escriben el `<img>` (`Sprite`, `PokemonArt`, montos, marca Shiny, barra lateral, paleta) con `assetSrc`; los datos (`sprites.json`, `datos.json`, `paneles.json`, `indice.json`, props) guardan la ruta sin versión y no crecen (§13.6). Esos archivos de datos se piden con la versión de los sprites, para que los frames de una fila y la versión que añade la isla sean del mismo build. Un `<img>` nuevo de un sprite o retrato pasa su `src` por `assetSrc`.

## Seguridad y derechos

- Solo lectura sobre el cliente: los scripts nunca modifican, ejecutan ni descifran archivos del juego.
- Si un archivo de entrada empieza con la firma `PKA1` (archivo protegido del cliente), el script se detiene. Solo se admiten archivos que el propietario ya descifró.
- La salida nunca se escribe dentro de la instalación del cliente (`...\AppData\Local\PokeAlliance Games`) ni dentro de la carpeta de los archivos de entrada (tampoco en subcarpetas con nombres como `..x`). El volcado nunca se escribe en `public/`; la única vía de `dump-outfits` hacia `public/` es `--registrar`, que solo escribe `public/sprites/outfits/<id>/` y `public/sprites/sprites.json`, acepta como máximo 50 outfits por ejecución, no acepta `--all` y valida cada outfit (cuatro direcciones y píxeles visibles) antes de escribir nada. El archivo de mapeo que modifica `--map` y la carpeta de sprites pasan por la misma comprobación.
- La carpeta de `--out` debe no existir, estar vacía o ser un volcado anterior de esta herramienta (se reconoce por su `README.txt` o su `manifest.json`). Si contiene un `README.txt` o un `manifest.json` de otro origen, o cualquier otro contenido, se detiene sin tocar nada.
- Cada volcado calcula el SHA-256 de las entradas solo como huella interna: si el cliente cambia, los outfits se regeneran. Esas huellas no se escriben en la salida.
- `--map` solo escribe `content/outfits.json` después de validar todas las demás opciones (selección, carpeta de salida, outfits a registrar), así que un comando con errores no deja el mapeo a medias.
- **Los derechos de redistribución de los sprites derivados del cliente no están establecidos.** El volcado es investigación privada: no hagas commit ni lo publiques sin revisión. El `README.txt` de la carpeta de salida lo recuerda.

## Elegir la carpeta del `things`

Indica la carpeta que contiene el `.dat` y el `.spr` descifrados con `--things`, o archivos exactos con `--dat` / `--spr`:

- `--things <carpeta>`: detecta `things_objectbuilder.dat`, luego `things.dat`, luego un único `*.dat`; `things.spr` o un único `*.spr`; y, si existen, `things.otml` y `things.otfi`. Si hay varios candidatos ambiguos, se detiene, los lista y pide `--dat` / `--spr`.
- `--dat <archivo>`, `--spr <archivo>`, `--otml <archivo>`, `--otfi <archivo>`: rutas exactas; tienen prioridad sobre `--things`. Con `--dat` y sin `--things`, el `.spr`, el `.otml` y el `.otfi` que no indiques se buscan junto al `.dat` (nunca en `PKA_DECRYPTED_THINGS` ni en la carpeta predeterminada, para no mezclar archivos de dos clientes).
- Prioridad: `--dat/--spr/--otml/--otfi` > `--things` > variable de entorno `PKA_DECRYPTED_THINGS` > carpeta predeterminada `C:\Users\jalom\AppData\Local\PokeAlliance Games\PokeAlliance\data\things\decrypted_objectbuilder`.
- Se aceptan rutas de Windows con espacios y con `\` o `/`. Las rutas resueltas se imprimen al inicio y se guardan en cada `outfit.json`.
- La carpeta predeterminada ya no existe en el equipo del propietario (2026-09-18); usa `--things`.
- La variable heredada `PKA_DAT_NAME` solo cambia el nombre del `.dat` dentro de `PKA_DECRYPTED_THINGS` o de la carpeta predeterminada; con `--things` se ignora.
- `--list` no necesita el `.spr`: si la carpeta solo tiene el `.dat`, o tiene varios `.spr`, lista igual.
- Una opción con valor vacío se rechaza (por ejemplo `--things "$things"` con `$things` sin definir) en vez de usar en silencio la carpeta predeterminada.
- `things.otfi` define el formato (`extended`, `transparency`, `frame-durations`, `frame-groups`). Sin `.otfi` se usa el formato del export actual: `extended` y `transparency` activados, sin duraciones ni grupos de frames.

## Ejemplos (PowerShell)

Define una vez la carpeta del `things` descifrado y cópiala en los comandos:

```powershell
$things = "C:\Users\jalom\Documents\pka_output_decrypt\2026-09-18_17-00-17\data\things"
```

```powershell
# Ver el catálogo: id, tamaño, capas, patrones, fases, grupos y slugs mapeados
pnpm assets:outfits -- --things $things --list
pnpm assets:outfits -- --things $things --list --json > outfits.json

# Archivos exactos en vez de carpeta
pnpm assets:outfits -- --dat "$things\things.dat" --spr "$things\things.spr" --slug charizard

# Un slug mapeado (todas las fases y direcciones)
pnpm assets:outfits -- --things $things --slug shiny-charizard

# Varios IDs, con hoja de sprites y máscara de color
pnpm assets:outfits -- --things $things --id 7,509 --sheet --layers

# Un rango, solo la pose quieta (fase 0)
pnpm assets:outfits -- --things $things --range 1-120 --frames idle

# Todos los outfits, solo fase 0 (≈ 20 s y ≈ 15 300 PNG)
pnpm assets:outfits -- --things $things --all --frames idle

# Hojas escaladas x4 para revisar a simple vista
pnpm assets:outfits -- --things $things --mapped --sheet --scale 4

# Ver qué se escribiría sin escribir nada
pnpm assets:outfits -- --things $things --all --dry-run

# Asignar el outfit de un Pokémon y publicarlo en el sitio
# (sustituye <slug> e <id> por el id de content/pokemon.json y el ID ya verificado con --list / ObjectBuilder)
pnpm assets:outfits -- --things $things --map "<slug>=<id>" --slug "<slug>" --registrar --dry-run
pnpm assets:outfits -- --things $things --map "<slug>=<id>" --slug "<slug>" --registrar

# Publicar un addon (los addons también son outfits) por su ID
pnpm assets:outfits -- --things $things --id 1005 --registrar

# Volver a publicar todos los Pokémon de content/outfits.json
pnpm assets:outfits -- --things $things --mapped --registrar
node scripts/assets/extract-outfit-preview.mjs --things $things
```

El `--` después de `pnpm assets:outfits` es opcional. Usa `--out <carpeta>` para escribir en otro sitio y `--help` para ver todas las opciones.

## Opciones de `dump-outfits`

| Opción                                                           | Efecto                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all`, `--id 7,509`, `--range 1-120`, `--slug a,b`, `--mapped` | Selección (se pueden combinar y repetir). Las listas aceptan comas o espacios, así que `--id 7,509` sin comillas también funciona en PowerShell. `--slug` y `--mapped` usan los Pokémon de `content/outfits.json`; los addons se eligen con `--id`. Obligatoria salvo con `--list` o `--map`.                                                                                                                                                                           |
| `--list [--json]`                                                | Lista outfits sin escribir imágenes. Con selección, lista solo esa selección. Si los grupos de frames difieren, la tabla muestra los valores de cada grupo separados por `/`, y los totales de máscara, addons y montura cuentan todos los grupos. `--json` incluye el formato y los conteos del DAT/SPR.                                                                                                                                                               |
| `--frames idle\|all`                                             | `all` (defecto): cada grupo × dirección × addon × montura × fase. `idle`: fase 0 (grupo idle si hay grupos de frames).                                                                                                                                                                                                                                                                                                                                                  |
| `--layers`                                                       | Escribe también la máscara de color (`_mask.png`, capa 1) y capas extra (`_layerN.png`). Por defecto solo se compone la capa 0 y se registra el número de capas.                                                                                                                                                                                                                                                                                                        |
| `--sheet`                                                        | Escribe `sheet.png` + `atlas.json` por outfit: filas = grupo × montura × addon × dirección, columnas = fases. No se escribe hoja para outfits cuyos frames son todos transparentes (salvo con `--keep-empty`). La hoja se codifica fila a fila: con `--scale 8`, el outfit 3887 (hoja de 67 840 × 5 120 px) usa unos 160 MB de memoria.                                                                                                                                 |
| `--scale N`                                                      | Escala entera de 1 a 8 (vecino más cercano).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `--keep-empty`                                                   | Escribe también frames y hojas totalmente transparentes (por defecto solo quedan marcados en `outfit.json`).                                                                                                                                                                                                                                                                                                                                                            |
| `--force`                                                        | Regenera aunque `outfit.json` indique que ya está al día. Sin `--force`, se omiten los outfits con las mismas entradas y opciones.                                                                                                                                                                                                                                                                                                                                      |
| `--dry-run`                                                      | Resuelve la selección, valida la carpeta de salida e imprime cuántos archivos se escribirían y cuántos outfits se omitirían por estar al día; no escribe nada (tampoco el mapeo).                                                                                                                                                                                                                                                                                       |
| `--map slug=id`                                                  | Valida (slug en kebab-case, outfit existente con cuatro direcciones y píxeles visibles) y añade o actualiza el `outfitId` del Pokémon en `content/outfits.json` conservando su formato; un Pokémon nuevo se añade al final con `"addons": []`. Imprime el diff. Nunca elimina registros ni addons.                                                                                                                                                                      |
| `--registrar`                                                    | Tras el volcado, escribe los frames idle (fase 0, capa 0, sin addon ni montura) de las cuatro direcciones de cada outfit elegido en `public/sprites/outfits/<id>/{norte,este,sur,oeste}.png` y añade o actualiza la entrada `outfits/<id>` de `public/sprites/sprites.json` (reemplaza una entrada de relleno). Son los mismos bytes que el volcado escribe con `--scale 1`. Necesita selección; máximo 50 outfits; no acepta `--all`. Con `--dry-run` solo lo anuncia. |
| `--preview`                                                      | Atajo de `--mapped --registrar`.                                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Salida

```text
<out>/
  README.txt                         aviso de uso privado
  manifest.json                      índice de todos los outfits volcados (se fusiona entre ejecuciones)
  outfit-<id>/
    <grupo>_<dirección>_a<addon>_m<montura>_p<fase>.png
    <grupo>_<dirección>_a<addon>_m<montura>_p<fase>_mask.png   (con --layers y capas > 1)
    sheet.png + atlas.json                                      (con --sheet)
    outfit.json
```

`<dirección>` es `north`, `east`, `south` o `west`. Los outfits con una sola dirección (`patternX` = 1) usan `any`, porque el mismo sprite sirve para cualquier orientación.

Si vuelves a volcar un outfit con otras opciones (por ejemplo `--frames idle` después de `all`), se borran primero los archivos que su `outfit.json` anterior registró como generados. Otros archivos de la carpeta no se tocan.

`outfit.json` incluye: id y slugs mapeados; atributos del DAT (byte crudo, payload en hex y valor decodificado); grupos de frames con dimensiones, `exactSize`, capas, patrones, fases, animación e IDs de sprite; opacidad y desplazamientos de `things.otml` cuando existen; por frame, los IDs de sprite, si está vacío y el SHA-256 del PNG; la lista de archivos emitidos con SHA-256; y `client` con el formato y los conteos del DAT/SPR, `toolVersion`, opciones y fecha.

## Notas del formato real (DAT 2026-09)

- DAT compatible con ObjectBuilder: firma `3166501110`, 50 704 items, 3 887 outfits, 2 882 efectos y 251 proyectiles; se lee completo hasta el último byte. Numeración de atributos 10.10+ de OTClient.
- Sin grupos de frames ni duraciones de animación (`frame-groups: false`, `frame-durations: false`): el nombre de grupo en los archivos es `default` y el cliente usa su temporización por defecto.
- `patternX` = 4 direcciones (N, E, S, O) en 3 876 outfits y 1 en 11. `patternY` (addons) y `patternZ` (montura) valen 1 en todos los outfits.
- Capas: 3 415 outfits con 1 capa, 471 con 2 (capa 1 = máscara de color amarillo/rojo/verde/azul) y el outfit 3359 con 21.
- 57 outfits no tienen sprites (todos los IDs a 0), por ejemplo el 1.
- Atributo propio de PokeAlliance con byte crudo `39`: 16 bytes en 1 055 outfits, nunca junto a `displacement` (byte `25`). Se decodifica como cuatro pares x/y con signo; la hipótesis (sin confirmar) es un desplazamiento por dirección.
- El SPR (~1 GB, 659 664 sprites, RGBA) se lee con acceso aleatorio mediante un descriptor de archivo; solo la tabla de direcciones (~2,6 MB) está en memoria.
- El DAT original sin convertir (`_pka_original/things.dat`) usa otra numeración de atributos y no está soportado: usa el `things.dat` compatible con ObjectBuilder.

## Pruebas

`tests/assets/otclient-things.test.ts` cubre argumentos, selección, nombres de frames, PNG (también el codificador por filas), disposición de hojas, resumen de `--list` con grupos de frames, rechazo de `PKA1` y protección de rutas de salida. También ejecuta el CLI de principio a fin: volcado, hojas, `--map` sobre un `outfits.json` sintético, `--registrar` (en una carpeta temporal indicada con `PKA_SPRITES_DIR`, nunca en `public/`), `--list --json` y rutas rechazadas. Todo usa fixtures **sintéticos** generados en la prueba y no necesita los archivos del cliente: `pnpm test`.

Variables de entorno para pruebas: `PKA_OUTFIT_MAPPING` sustituye a `content/outfits.json` y `PKA_SPRITES_DIR` a `public/sprites`.

Después de publicar sprites, ejecuta `pnpm content:check`. Guía de los registros: `docs/REGISTROS.md`.
