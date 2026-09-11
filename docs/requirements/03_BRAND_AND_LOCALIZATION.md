# BRANDING E IDENTIDAD DEL PROYECTO

El nombre oficial del proyecto será:

**Alliance Codex**

Descriptor inicial:

**PokeAlliance Wiki & Tools**

Nombre completo recomendado para metadata y SEO:

**Alliance Codex — PokeAlliance Wiki & Tools**

Nombre del repositorio:

```text
alliance-codex
```

Nombre del proyecto Vercel:

```text
alliance-codex
```

Nombre del proyecto Supabase:

```text
alliance-codex
```

Dominio principal deseado a futuro:

```text
alliancecodex.com
```

No construyas la identidad principal alrededor del término "Wiki", porque Alliance Codex deberá crecer posteriormente hacia:

* Wiki;
* Pokédex;
* guías;
* herramientas;
* calculadoras;
* hunts;
* Rotation Builder;
* Team Builder;
* cuentas;
* perfiles;
* contenido comunitario;
* marketplace;
* compra/venta de Pokémon;
* compra/venta de CACs;
* otras herramientas futuras.

La marca principal debe ser siempre:

**Alliance Codex**

y "PokeAlliance Wiki & Tools" debe funcionar únicamente como descriptor del producto.

Además, la interfaz debe dejar razonablemente claro que Alliance Codex es un proyecto comunitario independiente y no asumir ni dar a entender que es el sitio oficial de PokeAlliance.

---

# IDIOMAS PRINCIPALES

Alliance Codex será desarrollado principalmente en:

```text
Spanish
English
```

Los códigos base serán:

```text
es
en
```

El sistema debe diseñarse desde el principio para soportar correctamente ambos idiomas.

Sin embargo, hay una distinción CRÍTICA:

## 1. Idioma de interfaz y contenido

## 2. Terminología técnica del juego

Estas dos cosas NO son equivalentes y NO deben mezclarse.

---

# 1. IDIOMA DE INTERFAZ Y CONTENIDO

El usuario podrá elegir en qué idioma quiere leer Alliance Codex.

Inicialmente:

```text
Español
English
```

Esta selección debe afectar contenido como:

* navegación;
* botones;
* encabezados;
* explicaciones;
* descripciones;
* guías;
* instrucciones;
* tutoriales;
* explicaciones de sistemas;
* instrucciones de quests;
* mensajes de error;
* textos de ayuda;
* metadata;
* contenido editorial;
* labels propios de Alliance Codex;
* mensajes del marketplace;
* configuración de cuenta.

Ejemplo en español:

```text
Para completar esta misión debes dirigirte al norte de la ciudad y hablar con...
```

Ejemplo en inglés:

```text
To complete this quest, head north of the city and talk to...
```

Esta información sí debe traducirse.

---

# 2. TERMINOLOGÍA TÉCNICA DEL JUEGO

Los nombres pertenecientes directamente a PokeAlliance NO deben traducirse automáticamente sólo porque el usuario haya seleccionado español.

Debemos distinguir entre:

```text
UI/content language
```

y:

```text
canonical game terminology
```

La terminología oficial o canónica del juego debe conservarse tal como aparece realmente dentro de PokeAlliance.

Ejemplo:

Si el objeto dentro del juego se llama:

```text
Oran Berry
```

una guía en español debe poder decir:

```text
Necesitas entregar 20 Oran Berry.
```

NO:

```text
Necesitas entregar 20 Bayas Aranja.
```

si "Baya Aranja" no es el nombre utilizado realmente dentro de PokeAlliance.

El objetivo es que el usuario pueda buscar visualmente dentro del juego exactamente el mismo nombre que está leyendo en Alliance Codex.

---

# TERMINOLOGÍA CANÓNICA

Debemos conservar como nombres canónicos, cuando corresponda:

* Pokémon;
* Items;
* Berries;
* Moves;
* Held Items;
* Held X;
* Held Y;
* Boost Stones;
* materiales;
* Pokéballs;
* currencies;
* CACs;
* abilities;
* buffs;
* debuffs;
* nombres de sistemas;
* nombres de quests;
* nombres de NPCs;
* ciudades;
* regiones;
* hunts;
* dungeons;
* ubicaciones;
* nombres de objetos de quest;
* nombres de categorías internas del juego;
* comandos;
* cualquier otro identificador que el jugador necesite reconocer dentro de PokeAlliance.

La regla general es:

> Si el usuario necesita reconocer, buscar, comprar, vender, utilizar, escribir o encontrar esa entidad dentro del juego, su nombre canónico debe conservarse.

---

# EJEMPLO DE CONTENIDO MIXTO CORRECTO

Idioma seleccionado:

```text
Español
```

Contenido:

```text
Para completar esta quest necesitas conseguir 25 Oran Berry.

Puedes obtenerlas derrotando Pokémon de esta zona.

Después de reunirlas, vuelve con Robert y entrega los items.

Si tienes un Pokémon compatible con Teleport, puedes regresar más rápidamente.
```

Observa que:

```text
Para completar...
Puedes obtener...
Después...
puedes regresar...
```

está traducido.

Pero:

```text
Oran Berry
Robert
Teleport
```

mantiene su terminología real del juego.

Esto es el comportamiento deseado.

---

# EJEMPLO INCORRECTO

NO hagas traducciones arbitrarias como:

```text
Oran Berry → Baya Aranja

Health Stone → Piedra de Salud

Ultra Ball → Bola Ultra

X-Attack → Ataque X
```

si esos nombres no son los utilizados realmente dentro de PokeAlliance.

Alliance Codex no debe utilizar traducciones de los juegos oficiales de Pokémon para sustituir automáticamente términos propios de PokeAlliance.

---

# FUENTE DE VERDAD PARA LOS NOMBRES

El nombre técnico de cada entidad debe provenir, preferentemente, de:

1. PokeAlliance actual;
2. Wiki oficial de PokeAlliance;
3. información directamente verificada dentro del juego;
4. otra fuente confiable específicamente relacionada con PokeAlliance.

No utilices automáticamente:

* traducciones oficiales de Pokémon;
* Bulbapedia;
* Wikidex;
* Pokémon Database;
* Pokémon Showdown;
* PXG;
* otros PokéTibia;

para decidir cómo debe llamarse una entidad dentro de Alliance Codex.

Pueden utilizarse como referencia investigativa, pero no como autoridad para la terminología de PokeAlliance.

---

# MODELO DE DATOS PARA NOMBRES

No modeles una entidad únicamente así:

```ts
{
  name: "Oran Berry"
}
```

El modelo debe distinguir conceptualmente al menos:

```ts
{
  id: "oran-berry",

  canonicalName: "Oran Berry"
}
```

y cuando realmente existan traducciones oficiales o aliases útiles:

```ts
{
  id: "oran-berry",

  canonicalName: "Oran Berry",

  localizedNames: {
    en: "...",
    es: "..."
  },

  aliases: []
}
```

Sin embargo:

`localizedNames`

NO debe significar que Alliance Codex debe inventar traducciones.

Sólo debe contener valores respaldados por una razón real.

Si no existe una traducción oficial o útil:

```text
canonicalName = displayName
```

independientemente del idioma de la interfaz.

---

# CANONICAL NAME VS DISPLAY LABEL

Diseña claramente la diferencia entre:

```text
canonicalName
```

y:

```text
localized UI label
```

Ejemplo:

Entidad:

```text
canonicalName:
X-Lucky
```

En contenido español podemos mostrar:

```text
X-Lucky
```

y alrededor escribir:

```text
Aumenta la probabilidad efectiva de obtener determinados drops.
```

La explicación está localizada.

El nombre del sistema permanece canónico.

---

# MOVES

Esta regla es especialmente importante para los movimientos.

Ejemplo:

```text
Ice Beam
Blizzard
Hydro Pump
Earthquake
```

Si esos son los nombres actuales utilizados por PokeAlliance, deben mostrarse así incluso cuando Alliance Codex esté en español.

Una ficha española podría mostrar:

```text
Blizzard

Elemento: Ice
Cooldown: 12 s
Tipo de ataque: Área
```

No necesitamos convertirlo artificialmente en:

```text
Ventisca
```

salvo que PokeAlliance realmente tenga esa localización y decidamos soportarla explícitamente.

---

# ELEMENTOS Y CATEGORÍAS DE ALLIANCE CODEX

Hay una diferencia entre el nombre de una entidad del juego y una categoría creada por Alliance Codex.

Por ejemplo:

```text
Ice
Fire
Electric
Ground
```

deben tener una representación canónica interna estable.

Pero la interfaz puede mostrar:

Español:

```text
Hielo
Fuego
Eléctrico
Tierra
```

English:

```text
Ice
Fire
Electric
Ground
```

si estos textos son solamente labels explicativos de Alliance Codex.

Sin embargo, cuando estemos mostrando literalmente un atributo o término como aparece dentro del juego, debe poder conservarse su forma canónica.

Esta decisión debe estar centralizada y no resolverse de forma arbitraria componente por componente.

---

# DOS CAPAS DE LOCALIZACIÓN

La arquitectura debe pensar conceptualmente en dos capas:

```text
CONTENT LOCALE
```

y:

```text
GAME TERMINOLOGY
```

Ejemplo:

```text
Content locale:
es
```

puede producir:

```text
Rotación recomendada
Nivel requerido
Dónde encontrarlo
Cómo completar esta quest
```

mientras las entidades siguen apareciendo como:

```text
Shiny Magneton
Thunder
Electric Storm
X-Boost
Ultra Ball
Oran Berry
```

si esos son sus nombres canónicos.

---

# PREFERENCIA FUTURA DE TERMINOLOGÍA

Diseña el sistema de forma que en un futuro podamos permitir, si realmente resulta útil:

```text
Content language:
Spanish

Game terminology:
Canonical
```

o:

```text
Content language:
English

Game terminology:
Canonical
```

y eventualmente:

```text
Game terminology:
Localized
```

SOLAMENTE si existen traducciones fiables y existe una razón real para ofrecerlas.

Inicialmente:

**Canonical game terminology debe ser el comportamiento predeterminado.**

No construyas todavía una configuración complicada si no hace falta.

Pero evita una arquitectura que haga imposible añadir esta preferencia posteriormente.

---

# NOMBRES DE POKÉMON

Los nombres propios de Pokémon no deben traducirse arbitrariamente.

Ejemplo:

```text
Shiny Magneton
Shiny Miltank
Mega Abomasnow
```

deben conservarse como entidades canónicas.

---

# BÚSQUEDA Y ALIASES

Aunque la UI muestre el nombre canónico, la búsqueda futura puede ser tolerante.

Por ejemplo, un usuario español podría buscar:

```text
baya
```

y el sistema podría eventualmente encontrar Berries mediante aliases o keywords.

Pero:

**search alias ≠ display name**

No cambies el nombre mostrado únicamente para mejorar búsqueda.

El modelo debe permitir:

```text
canonicalName
aliases
searchKeywords
```

como conceptos diferentes.

---

# QUESTS

Las quests muestran perfectamente la separación de idiomas.

Una quest debe poder contener:

```text
canonicalTitle
```

y posteriormente contenido localizado:

```text
content.es
content.en
```

Ejemplo conceptual:

```text
Quest:
The Lost Research

Spanish content:
"Habla con Professor X y después consigue 15..."
```

si el nombre real de la quest es `The Lost Research`.

No traduzcas automáticamente el título a:

```text
La investigación perdida
```

si ese título no existe en PokeAlliance.

---

# NPCs Y LOCATIONS

Mantén nombres canónicos.

Ejemplo:

```text
Pewter City
Professor Oak
Cerulean Cave
```

si son los términos utilizados en PokeAlliance.

Una guía en español puede decir:

```text
Viaja hasta Pewter City y habla con...
```

Esto es correcto.

---

# ITEMS DENTRO DEL MARKETPLACE

Esta regla será especialmente importante cuando construyamos el marketplace.

Si alguien vende:

```text
Shiny Magneton
```

con:

```text
X-Boost
Ghost Held
Ultra Ball
```

la publicación debe utilizar los nombres reales reconocibles dentro del juego.

No se deben traducir técnicamente esos campos según el idioma del comprador.

La descripción escrita libremente por el vendedor sí puede estar en español o inglés.

---

# BASE DE DATOS Y TRADUCCIONES

No dupliques entidades completas por idioma.

Evita modelos como:

```text
pokemon_es
pokemon_en

items_es
items_en
```

La entidad del juego es la misma.

Ejemplo:

```text
item
  id
  canonical_name
  ...
```

El contenido localizado debe estar separado cuando sea necesario.

Dependiendo del dominio, se pueden utilizar patrones como:

```text
guide
guide_translation
```

o:

```text
quest
quest_translation
```

o estructuras equivalentes bien justificadas.

La investigación debe ayudar a determinar el modelo definitivo.

---

# CONTENIDO EDITORIAL

Las guías deberán poder existir en ambos idiomas.

Por ejemplo:

```text
guide
  id
  slug
```

y traducciones:

```text
guide_translation
  guide_id
  locale
  title
  summary
  content
```

No hace falta adoptar exactamente este schema si durante DATA MODEL CONSOLIDATION encontramos una solución mejor.

Pero NO dupliques toda la aplicación.

---

# FALLBACK DE IDIOMA

Define una estrategia explícita.

Idiomas soportados:

```text
es
en
```

Si una pieza de contenido todavía no está traducida al idioma elegido:

1. no generes una traducción automática silenciosamente;
2. utiliza el idioma disponible como fallback;
3. indica discretamente cuando el contenido todavía no está disponible en el idioma elegido, si aporta valor;
4. permite posteriormente completar la traducción.

Debe existir una configuración central:

```text
defaultLocale
supportedLocales
fallbackLocale
```

No hardcodees este comportamiento por página.

---

# IDIOMA POR DEFECTO

El proyecto debe poder configurar cuál es el idioma por defecto sin cambiar toda la arquitectura.

Inicialmente puede utilizarse:

```text
es
```

como idioma inicial de contenido.

Pero English debe ser un idioma de primera clase, no una traducción añadida artificialmente mucho después.

---

# DETECCIÓN DE IDIOMA

Podemos utilizar el idioma del navegador como sugerencia inicial.

Pero el usuario debe poder cambiarlo manualmente.

Cuando el usuario seleccione un idioma:

* conserva su preferencia;
* no vuelvas a cambiarlo automáticamente en cada visita.

Para usuarios autenticados, en el futuro la preferencia puede almacenarse también en su perfil.

Para visitantes anónimos puede utilizarse una cookie segura/preferencia local apropiada.

---

# URLs E IDIOMAS

Durante la fase de planificación analiza qué estrategia de URL resulta mejor para SEO y mantenibilidad.

Mi preferencia conceptual es una estructura explícita como:

```text
/es/...
/en/...
```

Ejemplo:

```text
/es/pokemon/shiny-magneton
/en/pokemon/shiny-magneton
```

Los IDs/slugs de entidades técnicas pueden permanecer estables.

Ejemplo:

```text
shiny-magneton
```

no necesita convertirse en:

```text
magneton-variocolor
```

sólo porque la página esté en español.

Las páginas localizadas deben utilizar correctamente:

* canonical;
* hreflang;
* sitemap;
* metadata;
* Open Graph.

Evita contenido duplicado incorrectamente indexado.

---

# SLUGS DE ENTIDADES

Para entidades del juego utiliza slugs canónicos estables.

Ejemplos:

```text
shiny-magneton
oran-berry
x-lucky
mega-abomasnow
```

No queremos:

```text
/es/pokemon/magneton-variocolor
/en/pokemon/shiny-magneton
```

representando dos IDs diferentes para la misma entidad.

La entidad debe tener identidad independiente del idioma.

---

# SLUGS EDITORIALES

Para contenido puramente editorial sí puede estudiarse si conviene localizar el slug.

Por ejemplo:

```text
/es/guias/sistema-de-boost
/en/guides/boost-system
```

Pero esto debe ser una decisión central de arquitectura y no una mezcla accidental.

---

# SEO MULTILINGÜE

Desde el principio prepara:

* `lang` correcto en HTML;
* `hreflang`;
* canonical;
* sitemap por idiomas;
* metadata localizada;
* title localizado;
* description localizada;
* Open Graph localizado.

No mezcles una página marcada como español con contenido principalmente inglés salvo la terminología canónica del juego.

La terminología técnica en inglés NO significa que la página sea contenido inglés.

Ejemplo:

```text
<html lang="es">
```

sigue siendo correcto para:

```text
Necesitas 20 Oran Berry y utilizar Ice Beam...
```

porque la explicación principal está en español.

---

# TRADUCCIÓN DE CONTENIDO

Las traducciones deben conservar el significado técnico.

Nunca traduzcas mecánicamente un documento sin proteger previamente nombres canónicos.

Antes de traducir contenido, la aplicación o pipeline debe poder distinguir:

```text
translatable text
```

de:

```text
game entity references
```

Idealmente una guía no debería depender únicamente de texto plano como:

```text
"Necesitas Oran Berry"
```

cuando podemos representar referencias estructuradas a entidades.

Conceptualmente podemos tener:

```text
Necesitas <ItemRef id="oran-berry" /> para...
```

o una solución equivalente.

El sistema de rendering decidirá mostrar:

```text
Oran Berry
```

Esto evita que una traducción accidental transforme el nombre técnico.

No es obligatorio utilizar exactamente MDX para todas estas referencias, pero diseña una estrategia equivalente.

---

# ENTITY REFERENCES

Cuando contenido editorial haga referencia a:

* Pokémon;
* Item;
* Move;
* Quest;
* NPC;
* Location;
* Held;
* Hunt;

prefiere cuando sea razonable referencias por ID en vez de repetir información arbitrariamente.

Ejemplo conceptual:

```text
pokemon:shiny-magneton
item:oran-berry
move:ice-beam
```

Esto permitirá:

* enlaces automáticos;
* tooltips;
* nombres consistentes;
* futuras traducciones;
* actualización centralizada;
* búsqueda;
* detección de enlaces rotos.

No sobreingenierices el parser inicialmente, pero deja este problema considerado en DATA_STRATEGY.

---

# GLOSARIO

Construye durante la investigación un:

```text
knowledge/localization/
  GLOSSARY.md
```

y, si es útil, un dataset estructurado:

```text
data/normalized/terminology.json
```

Debe identificar al menos:

```text
canonical term
entity type
source
shouldTranslate
notes
```

Ejemplo conceptual:

```json
{
  "canonical": "Oran Berry",
  "type": "item",
  "shouldTranslate": false
}
```

Otro:

```json
{
  "canonical": "Required Level",
  "type": "ui-label",
  "shouldTranslate": true,
  "translations": {
    "es": "Nivel requerido",
    "en": "Required Level"
  }
}
```

Esto debe ayudar tanto a la aplicación como a futuras IAs.

---

# REGLAS PARA AGENTES DE IA

Añade estas reglas a `AGENTS.md`.

## Regla 1

Nunca traduzcas nombres canónicos de entidades del juego sin evidencia explícita de que PokeAlliance utiliza esa traducción.

## Regla 2

Distingue siempre:

```text
game data
```

de:

```text
editorial content
```

## Regla 3

El contenido editorial puede traducirse.

Las entidades canónicas generalmente no.

## Regla 4

No utilices traducciones de Pokémon oficial para sustituir nombres de PokeAlliance.

## Regla 5

Si no estás seguro de si algo es un nombre canónico o texto traducible, investígalo antes de modificarlo.

## Regla 6

Nunca modifiques IDs canónicos sólo por cambiar de idioma.

## Regla 7

Cuando crees contenido español, puedes utilizar naturalmente frases españolas alrededor de términos técnicos ingleses.

Esto NO debe considerarse un problema de traducción.

---

# EJEMPLOS PARA LA IA

CORRECTO:

```text
Shiny Magneton puede utilizarse como una opción de la rotación Electric gracias a sus movimientos de área.
```

INCORRECTO:

```text
Magneton Variocolor puede utilizarse como una opción de la rotación Eléctrica...
```

si PokeAlliance lo llama `Shiny Magneton`.

CORRECTO:

```text
Necesitas 50 Oran Berry.
```

INCORRECTO:

```text
Necesitas 50 Bayas Aranja.
```

CORRECTO:

```text
El cooldown de Ice Beam es...
```

INCORRECTO:

```text
El tiempo de reutilización de Rayo Hielo...
```

si `Ice Beam` es el nombre real del move.

CORRECTO:

```text
Held recomendado: X-Lucky
```

INCORRECTO:

```text
Objeto equipado recomendado: X-Suerte
```

si ese nombre no existe dentro del juego.

---

# INVESTIGACIÓN MULTILINGÜE

Durante la fase de investigación busca fuentes en:

* español;
* inglés;
* portugués cuando resulte útil;
* otros idiomas si contienen información relevante.

El idioma de una fuente no determina automáticamente el nombre canónico de una entidad.

Una wiki portuguesa puede contener información útil sin que sus traducciones deban convertirse en la terminología de Alliance Codex.

Extrae el conocimiento.

Normalízalo.

Conserva la terminología correcta.

---

# CONTENIDO ORIGINAL DE ALLIANCE CODEX

Cuando Alliance Codex genere explicaciones propias, éstas deberán poder existir tanto en español como en inglés.

Evita hacer que una versión sea conceptualmente "la original" y la otra una copia inferior.

Ambas deben poder mantenerse y corregirse.

Sin embargo, puede existir un campo que registre:

```text
translationStatus
```

por ejemplo:

```text
original
reviewed
translated
needs_review
outdated
```

si durante la investigación determinamos que aporta valor.

---

# ACTUALIZACIONES Y TRADUCCIONES OBSOLETAS

Cuando cambie información del juego, una traducción puede quedar desactualizada.

El sistema debe estar preparado para detectar conceptualmente:

```text
source content updated
↓
other locale potentially outdated
```

No hace falta implementar ahora un CMS avanzado.

Pero el modelo futuro no debe asumir que:

```text
Spanish version updated
=
English version automatically correct
```

---

# FUTURO MARKETPLACE MULTILINGÜE

En el marketplace futuro:

La estructura técnica de una publicación utilizará entidades canónicas.

Ejemplo:

```text
Pokemon:
Shiny Magneton

Ball:
Ultra Ball

Held X:
X-Boost

Held Y:
...
```

Estos valores no dependen del idioma de interfaz.

En cambio:

```text
Comprar
Vender
Precio
Publicado hace...
Contactar vendedor
Descripción
Reportar publicación
```

sí dependen del idioma.

Las descripciones escritas por usuarios NO deben traducirse automáticamente por defecto.

Se mostrarán en el idioma en que fueron publicadas, salvo que posteriormente construyamos una función específica de traducción.

---

# ARQUITECTURA: UNA ENTIDAD, MÚLTIPLES PRESENTACIONES

La filosofía global debe ser:

```text
ONE DOMAIN ENTITY
+
LOCALIZED PRESENTATION
```

NO:

```text
SPANISH ENTITY
+
ENGLISH ENTITY
```

Ejemplo:

```text
Shiny Magneton
```

existe una sola vez como entidad.

Sus:

* stats;
* tier;
* moves;
* boost;
* rotations;
* sources;

son datos del juego.

Las explicaciones alrededor de esos datos pueden existir en:

```text
es
en
```

---

# CRITERIO DE DISEÑO FINAL

En cualquier pantalla, antes de traducir un texto, pregunta conceptualmente:

> ¿Esto es lenguaje de Alliance Codex o es información/nomenclatura que el jugador reconoce dentro de PokeAlliance?

Si es lenguaje de Alliance Codex:

**tradúcelo.**

Si es nomenclatura canónica del juego:

**consérvala.**

Si existe una traducción oficial real y queremos soportarla:

**almacénala como localización respaldada por una fuente, nunca como traducción inventada.**

---

# ACTUALIZACIÓN DE LAS PRIMERAS FASES

La internacionalización debe formar parte desde PHASE 0 y PHASE 1.

Durante MASTER PLANNING debe existir una sección específica de:

```text
Localization Architecture
```

Durante DEEP POKEALLIANCE RESEARCH debe investigarse también:

* terminología canónica;
* nombres exactos utilizados por el juego;
* diferencias entre fuentes;
* aliases;
* traducciones existentes;
* términos que NO deben traducirse.

Durante DATA MODEL CONSOLIDATION debe definirse definitivamente:

* locale model;
* canonical names;
* localized content;
* fallback behavior;
* routing;
* SEO multilingual;
* translation status.

No pospongas estas decisiones hasta después de haber construido toda la wiki.

El proyecto debe nacer bilingüe arquitectónicamente aunque la cantidad de contenido inicial disponible en cada idioma todavía sea diferente.

