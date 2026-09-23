# Programa de conocimiento completo de PokeAlliance

Status: implementación activa desde la auditoría del 2026-09-15; actualizado el 2026-09-18 por D-011 (registros JSON editables en `content/`) y D-012 (sin procedencia). No declara cobertura completa.

## Resultado buscado

Alliance Codex debe responder, conectar y permitir explorar toda la información útil del servidor: Pokémon y variantes, movesets, ubicaciones, spawns, loot, cantidades y probabilidades cuando existan, items, hunts, NPCs, quests, sistemas, progresión, economía, actividades y cambios del juego.

La meta no es copiar otras wikis. Es construir un modelo propio que permita preguntas cruzadas:

- ¿Dónde aparece este Pokémon y qué condiciones tiene cada lugar?
- ¿Qué puede dropear y qué probabilidad o rango de cantidad tiene cada drop?
- ¿Quién dropea este item, dónde se usa y cuánto necesito para una mejora?
- ¿Qué quest desbloquea una zona, sistema o recompensa?
- ¿Qué progreso me conviene hacer antes y qué depende de él?
- ¿Qué cambió desde la última versión revisada?

## Punto de partida comprobado

La investigación previa dejó una base correcta, pero no una base completa:

- la wiki administrada presenta 530 Pokémon base y 910 filas contando variantes;
- la aplicación pública actual cubre múltiples familias de guías, sistemas, progresión, actividades, economía y quests;
- la wiki comunitaria de Lukkezin muestra 425 Pokémon y listas amplias de drops, ubicaciones, dungeons, tasks, medals y Boost, sin garantía de actualidad;
- `content/` contiene el roster de 910 variantes y una muestra de movimiento, ubicación, item, quest y regla de tier;
- el cliente local autorizado aporta inventario de módulos, 119 marcadores y una base OTMM utilizable, pero no una relación completa Pokémon-ubicación;
- las probabilidades exactas no están publicadas de forma general. En particular, la documentación actual indica que ciertas rates de Shiny permanecen ocultas.

Por tanto, una lista de drops no equivale a una tabla de chances, un nombre de ubicación no equivale a coordenadas y una cobertura amplia de una wiki comunitaria no equivale a contenido actual.

## Sin procedencia (D-012)

La procedencia no existe en los datos, en la UI ni en el modelo:

- no hay sección `Fuentes`, enlaces de evidencia, badges de origen o de verificación, contadores, IDs internos, hashes ni fechas de consulta;
- no se guardan fuentes, evidencias, claims, estados de verificación ni confianza;
- un valor desconocido es `null` y se muestra como `—`; nunca `0` ni una frase del tipo «no publicada» o «aún no confirmada»;
- un bloque sin datos se omite;
- los registros de relleno llevan `"borrador": true`;
- el propietario decide los valores y los escribe en `content/`; Git es el único historial de cambios.

## Modelo integral de información

### Entidades principales

1. Pokémon species y variantes: base, Shiny, Mega, formas y excepciones del servidor.
2. Moves: slot, PVE/PVP, elemento, cooldown, daño cuando exista, área, alcance, objetivos, efectos y restricciones.
3. Items: categoría, uso, stack, tradeability, obtención, consumo, recetas, precios y relaciones con sistemas.
4. Drop relations: criatura o contenedor, item, cantidad mínima/máxima, rate, contexto, modificadores y vigencia.
5. Locations: región, ciudad, subzona, hunt, dungeon, piso, coordenadas, acceso, nivel y transporte.
6. Spawn relations: Pokémon, variante, ubicación, densidad o respawn si se conoce, condiciones y método de aparición.
7. Quests: requisitos, pasos ordenados, bifurcaciones, NPCs, ubicaciones, consumo de items, recompensas, desbloqueos y repetibilidad.
8. NPCs: identidad, roles, ubicaciones, tienda, diálogo funcional, quests y servicios.
9. Systems: Boost, Stars, Mega, training, talents, Helds, medals, runes/PokéLog, tasks, Hazard, Wildscape, Primal, guild, VIP y otros sistemas actuales.
10. Progression milestones: nivel, accesos, prerequisitos, costos, recomendaciones editoriales y dependencias.
11. Activities: hunts, dungeons, raids, events, calendar, game pass, rockets, police, gyms y contenido semanal.
12. Economy: currencies, vendors, sinks, rewards, market rules y precios sólo cuando la volatilidad permita mostrarlos responsablemente.
13. Change events: alta, modificación, deprecación o retiro de entidades y reglas por versión/fecha efectiva.

### Relaciones que deben ser de primera clase

`Pokémon -> drops -> items -> usos -> sistemas/quests`

`Pokémon -> spawns -> hunts/locations -> acceso -> quests/progress`

`Quest -> pasos -> NPC/location/item/Pokémon -> recompensa/desbloqueo`

`System -> requisitos/costos -> items/currencies -> beneficios -> incompatibilidades`

`Change event -> entidades afectadas -> versión efectiva -> datos que deben revalidarse`

No se duplicarán estas relaciones como texto manual en varias páginas. Cada vista las compone desde registros canónicos.

## Investigación profunda y repetible

La investigación no se considera una pasada única. Cada dominio recorre seis ciclos y vuelve a empezar cuando cambia una fuente o el juego.

### Ciclo 1: inventario de amplitud

- Enumerar rutas, endpoints, bundles públicos, categorías, archivos permitidos y datasets candidatos.
- Definir el denominador antes de medir cobertura: especies base, variantes, formas, ubicaciones o relaciones no comparten el mismo total.
- Registrar campos esperados y detectar dominios ausentes.

Salida: inventario versionado, denominadores y matriz de huecos.

### Ciclo 2: extracción directa

- Extraer datos estructurados de superficies públicas y archivos locales permitidos.
- Importadores idempotentes que escriben `content/` y no pisan valores editados a mano.
- Dejar `null` cuando el campo no existe; ningún default de Pokémon tradicional.

Salida: `content/` actualizado y un resumen de cambios.

### Ciclo 3: contraste

- Comparar wiki administrada, changelog, cliente visible y wikis comunitarias antes de escribir un valor.
- Decidir campo por campo, no ficha completa.
- Si dos valores no se pueden reconciliar, el propietario elige; mientras tanto el campo queda `null`.

Salida: valores decididos y preguntas abiertas para el propietario.

### Ciclo 4: observación dirigida

- Diseñar capturas ordinarias dentro del juego para los huecos que no aparecen en archivos legibles: ubicación, piso, condición, ventana temporal o resultado de una acción.
- Una frecuencia medida por jugadores no es una probabilidad del juego: sólo entra como rango si el propietario la acepta.

Salida: valores nuevos para `content/`.

### Ciclo 5: auditoría adversarial

- Buscar contraejemplos, contenido retirado, variantes confundidas, aliases, duplicados, traducciones inventadas y dependencias circulares.
- Muestrear registros aleatorios y los de mayor impacto.
- Verificar que cada relación inversa devuelve el mismo conjunto.

Salida: auditoría de consistencia, regresiones y cobertura honesta.

### Ciclo 6: vigilancia de cambios

- Leer el feed del launcher y las rutas públicas con una cadencia razonable (acción diaria prevista en `ROADMAP.md`).
- Reabrir sólo los registros afectados por cambios.
- Retirar de las vistas públicas lo que pueda inducir una mala decisión.

Salida: entradas de Cambios y lista de registros por revisar.

## Estrategia para drops y probabilidades

Cada drop usa uno de estos `rate_kind`:

- `unknown`: el item puede aparecer y la probabilidad no se conoce (se muestra `—`);
- `exact`: probabilidad publicada por el juego;
- `range`: mínimo y máximo aceptados por el propietario (se muestra `≈`);
- `conditional`: depende de Premium, evento, Boost, bonus, variante, área o sistema.

Las rates ocultas por el servidor quedan `null`; no se reconstruyen desde binarios protegidos ni se promete una exactitud inexistente.

## Arquitectura de experiencia

### Búsqueda universal

Un único buscador encuentra Pokémon, items, quests, NPCs, ubicaciones, hunts y sistemas. Tolera aliases y términos en español/inglés sin renombrar entidades canónicas. Los resultados se agrupan por intención y permiten acciones rápidas: `ver en mapa`, `quién lo dropea`, `se usa en` y `comparar`.

### Ficha de Pokémon

Cabecera compacta con identidad, variante, tier, level, elementos y cambio de variante. Debajo:

1. disponibilidad y ubicaciones;
2. moveset PVE/PVP con lectura de cooldown y AoE;
3. loot con cantidad/rate cuando exista;
4. progresión, evolución, Boost, Stars/Mega, training y compatibilidades;
5. relaciones con quests, hunts y herramientas.

No habrá introducción genérica, IDs técnicos ni bloque de fuentes. Las secciones vacías se omiten.

### Ficha de item

Empieza por `para qué sirve`, `cómo se obtiene` y `cuánto se necesita`. Después muestra criaturas que lo dropean, tiendas/quests/actividades, recetas o sistemas consumidores y alternativas. Un selector invierte inmediatamente la relación entre `obtener` y `usar`.

### Ubicaciones y mapa

Mapa por capas con pisos, regiones, hunts, travel, NPCs, quests, Pokémon y servicios. Seleccionar un objeto abre un inspector lateral, no un modal. Los filtros viven fuera del lienzo y pueden producir una URL compartible.

Una ubicación sin coordenadas puede existir como área semántica, pero no se dibuja como punto inventado. Capturas o álbumes visuales pasan por alineación con OTMM antes de convertirse en geometría.

### Quests y progresión

Las quests se leen como checklist operativo: requisitos, ruta, pasos, consumo, combate, recompensa y desbloqueos. Las dependencias forman un grafo explorable y una vista `qué hacer ahora` filtrada por nivel, accesos y objetivo. El progreso personal sólo se activa cuando Accounts lo permita; la wiki no exige sesión.

### Sistemas

Cada sistema combina una explicación corta, reglas, costos, límites, incompatibilidades y calculadora cuando el modelo lo permita. Una tabla o diagrama reemplaza párrafos repetitivos. Reglas como Mega vs Stars deben aparecer justo donde se toma la decisión.

### Navegación contextual

Las relaciones relevantes aparecen como enlaces compactos dentro del flujo. No se agrega una cuadrícula genérica de `contenido relacionado` a todas las páginas. La navegación global conserva categorías estables y deja que la búsqueda resuelva la cola larga.

## Dirección visual y movimiento

Escena de uso: un jugador consulta Alliance Codex junto a PokeAlliance en una pantalla grande o desde el teléfono durante una hunt, con poco tiempo para leer y necesidad de distinguir números, rutas y condiciones sin perder contexto.

La estrategia visual es contenida: neutros oscuros tintados, un acento funcional limitado y color semántico reservado para elementos, estados y capas de mapa. Se conserva la estructura wiki RubinOT ya aprobada, pero las páginas de entidad usan composiciones específicas en lugar de una cuadrícula de tarjetas repetidas.

- Tipografía compacta y legible; cuerpo de lectura limitado a 65-75 caracteres cuando es prosa.
- Ritmo más denso en tablas/listas y más aire sólo alrededor de decisiones complejas.
- Bordes físicos de 1 px, sin sombras de tarjeta, gradientes decorativos, glassmorphism ni cajas anidadas.
- Sprites o iconografía sólo cuando aceleran reconocimiento. Nunca como relleno.
- Motion de 120-220 ms con `transform` y `opacity`, curvas ease-out y propósito: cambio de variante, apertura del inspector, filtro aplicado, transición de piso y realce de una relación.
- Sin bounce, parallax, animación continua ni movimiento de layout. `prefers-reduced-motion` conserva el estado final sin transición.
- Hover, focus y selección son distinguibles; el color no es la única señal.

## Contenido que se elimina o evita

- Prosa que repite el título o explica que una wiki contiene información.
- Métricas de cobertura en la portada pública.
- Etiquetas editoriales como `muestra`, `normalizado`, `evidencia` y `fuente`.
- Fechas de verificación o de consulta.
- Secciones vacías con mensajes largos.
- Tarjetas idénticas para entidades con estructuras distintas.
- Advertencias globales repetidas; cada límite aparece una sola vez en el punto de decisión.

## Edge cases obligatorios

- Variantes que comparten Pokédex number pero cambian tier, moveset, drop, ubicación o progresión.
- Aliases, mayúsculas y nombres canónicos que no deben traducirse.
- Pokémon o items retirados, temporales, exclusivos de evento o aún visibles en datasets viejos.
- Drop condicionado por variante, contenedor, área, Premium, evento o bonus activo.
- Cantidades variables, múltiples rolls, pity, bonus y modificadores que no pueden combinarse como una sola rate.
- Ubicaciones con el mismo nombre, varios pisos, accesos alternativos o fronteras imprecisas.
- Spawn conocido por área pero sin coordenada; coordenada observada sin identidad de la subzona.
- Quest repetible, diaria, semanal, de una sola vez, con ramas, pasos fuera de orden o recompensa elegible.
- Cambios de quest que dejan progreso antiguo incompatible.
- NPC móvil, temporal o con servicios dependientes de horario/evento.
- Precios y economía volátiles; no mostrar una cifra vieja como valor actual.
- Relaciones circulares de crafting o mejora y costos que dependen del nivel actual.
- Datos contradictorios entre idiomas o páginas de distinta fecha.
- Búsqueda sin resultados, errores de importación, contenido parcial y estado offline.
- Tablas anchas, mapas y grafos en móvil sin overflow de documento.
- Carga de cientos de sprites o miles de relaciones sin afectar LCP, CLS o memoria.
- Contribuciones con HTML, enlaces maliciosos, spam o datos personales.

## Orden de implementación

### Etapa A: contrato y medición (implementada localmente)

- Cerradas las matrices de campos para diecisiete dominios.
- Definidos denominadores separados por dominio.
- Extendido localmente el esquema temporal y relacional para drops, spawns, progresión, actividades, economía y cambios.
- Definida la política de rates desconocidas y contenido retirado.

Gate local: la migración nueva sigue pendiente de aplicación remota y prueba SQL integrada. Los validadores de procedencia y los reportes de cobertura se eliminaron con D-012.

### Etapa B: inventario canónico (en curso)

- Importado el roster completo actual de 910 variantes a `content/pokemon.json` (`pnpm content:roster` lo actualiza).
- Consolidar elementos, tiers, levels, roles, evoluciones y movesets disponibles.
- Resolver duplicados y aliases antes de publicar índices completos.

Gate: denominador documentado, IDs estables, variantes verificadas y búsqueda bilingüe sin colisiones.

### Etapa C: items, loot y usos

- Crear el catálogo de items en `content/items/` (D-011) y las relaciones de drop/uso.
- Usar las listas comunitarias como referencia para que el propietario decida, no como verdad automática.
- Separar drop sin rate, rate exacta, rango y condición.
- Construir búsqueda inversa `item -> cómo se obtiene`.

Gate: integridad bidireccional, condiciones modeladas y cero chances inventadas.

### Etapa D: mundo, hunts y mapa

- Consolidar regiones, ciudades, subzonas, hunts, travel y servicios.
- Alinear capturas del juego con OTMM.
- Incorporar spawns por área antes de exigir coordenadas puntuales.
- Crear inspector de mapa y URLs compartibles.

Gate: ninguna geometría inventada, pisos correctos, capas accesibles y navegación móvil verificada.

### Etapa E: quests, NPCs y progresión

- Importar quests por familias, con pasos y dependencias.
- Conectar NPCs, items, combates, ubicaciones y desbloqueos.
- Construir índice de progresión y grafos de prerequisitos.

Gate: 100% de pasos publicados con estructura revisada, ramas/repetibilidad explícitas y sin callejones falsos.

### Etapa F: sistemas y actividades

- Modelar reglas, costos, límites y compatibilidades de cada sistema.
- Añadir calculadoras sólo cuando los datos sean completos para su operación.
- Integrar contenido temporal y calendario con vigencia explícita.

Gate: cada cálculo tiene casos límite, versión efectiva y pruebas de dominio.

### Etapa G: experiencia integrada (parcial)

- Rehacer home, búsqueda e índices alrededor del catálogo real.
- Implementar fichas especializadas, comparación contextual y navegación relacional.
- Retirada la procedencia de la UI, los datos y el modelo (D-012).
- Aplicar movimiento sutil, responsive, accesibilidad y presupuestos de rendimiento.

Gate: recorridos completos de intención, auditoría visual, teclado, reduced motion, móvil/escritorio, SEO y rendimiento.

## Criterios de completitud

`Toda la información` no se declara por tener muchas páginas. Requiere:

- inventario y denominador definidos por dominio;
- cobertura medida por campos y relaciones, no sólo por entidades;
- cero valores inventados;
- valores contradictorios decididos por el propietario o dejados en `null`;
- relaciones inversas consistentes;
- cambios del juego revisados a partir del changelog;
- UI sin procedencia, ruido editorial ni bloques decorativos;
- pruebas de búsqueda, fichas, mapa, quests, filtros y calculadoras;
- aceptación visual del propietario separada de los checks automáticos.

El cierre ideal por dominio es 95% o más de identidad y campos fundamentales, 90% o más de relaciones accionables y 100% de los valores numéricos publicados con contexto suficiente. Un campo que el servidor mantiene secreto puede quedar `null` sin impedir el cierre, siempre que no se sustituya por una cifra falsa.

## Siguiente acción concreta

Construir los registros de D-011 (`content/items/*`, `content/outfits.json`, `content/auras.json`, `public/sprites/sprites.json`, JSON Schemas y `pnpm content:check`) con valores de relleno que el propietario completará. Después, completar la Etapa B (conteo de especies, aliases, evoluciones y movesets) y comenzar la Etapa C con las 802 relaciones de drop como referencia, separando drop sin rate, rate exacta, rango y condición.
