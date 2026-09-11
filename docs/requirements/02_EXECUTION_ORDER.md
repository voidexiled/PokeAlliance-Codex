# ORDEN DE EJECUCIÓN OBLIGATORIO

Este proyecto debe desarrollarse siguiendo estrictamente las siguientes fases.

**NO empieces construyendo la aplicación.**

El principal error que quiero evitar es diseñar la base de datos, dominio, Pokédex o arquitectura de contenido antes de comprender suficientemente bien PokeAlliance.

La primera etapa del proyecto es planificación.

La segunda etapa es investigación.

La tercera etapa es consolidación y modelado de datos.

**Sólo después comienza el desarrollo de la aplicación.**

No saltes fases porque ya tengas una idea razonable de cómo construir una wiki de Pokémon.

PokeAlliance tiene sistemas, variantes, movesets, tiers, reglas y comportamientos propios.

---

# PHASE 0 — MASTER PLANNING

## Objetivo

Antes de instalar dependencias, configurar Astro, crear Supabase o desarrollar interfaces, crea un plan completo para la construcción del proyecto.

En esta fase puedes inspeccionar el repositorio y crear documentación.

NO debes todavía:

* inicializar Astro;
* instalar dependencias;
* crear componentes;
* crear interfaces;
* crear tablas reales en Supabase;
* desplegar a Vercel;
* construir la Pokédex;
* implementar Auth;
* construir herramientas.

Primero piensa el proyecto.

## Archivos que debes crear

Como mínimo:

```text
docs/
  MASTER_PLAN.md
  RESEARCH_PLAN.md
  DATA_STRATEGY.md
  ARCHITECTURE_PROPOSAL.md
  ROADMAP.md
  RISKS_AND_UNKNOWNS.md
```

También crea un primer:

```text
AGENTS.md
```

que posteriormente podrá enriquecerse con lo aprendido durante la investigación.

---

# MASTER_PLAN.md

Debe explicar:

* visión completa del producto;
* objetivos;
* prioridades;
* fases;
* dependencias entre fases;
* arquitectura conceptual;
* estrategia de datos;
* estrategia de fuentes;
* estrategia de desarrollo;
* seguridad;
* escalabilidad;
* testing;
* deployment;
* futuras herramientas;
* Auth;
* marketplace futuro;
* riesgos;
* decisiones que todavía no debemos tomar.

El plan debe estar pensado antes de empezar a programar.

---

# RESEARCH_PLAN.md

Debe ser especialmente importante.

Define:

* qué necesitamos aprender de PokeAlliance;
* dónde lo vamos a buscar;
* cómo vamos a comprobar información;
* cómo vamos a resolver contradicciones;
* cómo vamos a registrar información desconocida;
* cómo vamos a detectar información desactualizada;
* qué datasets necesitamos obtener;
* qué porcentaje aproximado de cada dominio hemos investigado.

Divide la investigación por dominios.

---

# DATA_STRATEGY.md

Antes de diseñar definitivamente PostgreSQL, explica cómo se representará el conocimiento.

Debemos distinguir al menos:

```text
raw research
↓
staging data
↓
normalized data
↓
application database
```

No diseñes la base de datos únicamente pensando en las páginas que ya conocemos.

Debemos diseñarla después de comprender mejor el juego.

---

# ARCHITECTURE_PROPOSAL.md

Aquí puedes proponer inicialmente:

* Astro;
* React;
* Tailwind;
* shadcn/ui;
* Supabase;
* Vercel;
* estructura de carpetas;
* separación estático/dinámico.

Pero esta arquitectura todavía puede refinarse después de la investigación.

No conviertas una decisión provisional en permanente antes de conocer el dominio.

---

# RISKS_AND_UNKNOWNS.md

Registra explícitamente cosas que todavía no sabemos.

Ejemplo:

```text
UNKNOWN

Current Teleport-compatible Pokémon list

Reason:
Official guide documents the mechanic but not the species list.

Evidence:
...

Possible leads:
...
```

Quiero que el proyecto trate los desconocidos como información de primera clase.

---

# EXIT CRITERIA — PHASE 0

No consideres terminada la planificación hasta que exista:

* roadmap claro;
* plan de investigación;
* estrategia de datos;
* propuesta de arquitectura;
* taxonomía de fuentes;
* criterios de confianza;
* lista inicial de dominios del juego;
* lista inicial de riesgos;
* definición de qué significa completar la fase de investigación.

Después pasa automáticamente a Phase 1.

No necesitas detenerte a pedirme autorización.

---

# PHASE 1 — DEEP POKEALLIANCE RESEARCH

Esta fase es crítica.

Antes de construir la aplicación, realiza una investigación extensa de PokeAlliance.

El objetivo no es hacer un resumen del juego.

El objetivo es construir una **base de conocimiento estructurada que pueda ser utilizada posteriormente directamente por la aplicación y por agentes de IA**.

Debes investigar tantas fuentes públicas relevantes como razonablemente puedas encontrar.

No te limites a los enlaces que ya te proporcioné.

Debes descubrir nuevas fuentes.

---

# SOURCE DISCOVERY

Empieza haciendo un mapa amplio de fuentes.

Busca:

## Oficiales

* wiki oficial;
* Pokédex oficial;
* guías oficiales;
* documentación de sistemas;
* reglas;
* changelogs;
* anuncios;
* páginas del servidor;
* herramientas oficiales;
* cualquier API/endpoints públicos razonablemente accesibles;
* repositorios oficiales si existen.

## Comunitarias

Busca:

* wikis;
* herramientas;
* Pokédex alternativas;
* calculadoras;
* tier lists;
* mapas;
* guías;
* repositorios GitHub;
* datasets;
* páginas personales;
* posts comunitarios;
* vídeos cuando aporten evidencia no disponible en texto;
* discusiones comunitarias relevantes;
* otras herramientas construidas por jugadores.

Discord u otras comunidades pueden considerarse cuando sean públicamente accesibles o cuando posteriormente se proporcione acceso.

---

# FUENTES INICIALES YA CONOCIDAS

Como mínimo investiga exhaustivamente:

## Wiki oficial

https://wiki.pokealliance.com

https://wiki.pokealliance.com/pokemon

## Wiki comunitaria

https://pokealliance-wiki.vercel.app

## Repositorio comunitario

https://github.com/thiagobfo/pokealliance-wiki

## Repositorio histórico relacionado

https://github.com/tanjirokamadoserver/PokeMonster

IMPORTANTE:

El repositorio `PokeMonster` NO es prueba automática del comportamiento actual de PokeAlliance.

Debe etiquetarse como:

```text
historical
```

y utilizarse principalmente para:

* descubrir posibles mecanismos;
* identificar campos interesantes;
* generar hipótesis;
* encontrar nombres de sistemas;
* orientar investigación posterior.

No lo utilices silenciosamente como fuente actual.

---

# SOURCE REGISTRY

Construye:

```text
knowledge/sources/
```

y también un registro estructurado.

Cada fuente debe poder registrar:

```text
name
url
sourceType
authority
scope
language
lastCheckedAt
lastSuccessfulAt
freshness
notes
```

Tipos posibles:

```text
official
official_announcement
ingame_verified
community_verified
community
historical
inferred
unknown
```

---

# INVESTIGACIÓN BREADTH-FIRST PRIMERO

No empieces investigando obsesivamente un solo Pokémon.

Primero descubre:

* qué fuentes existen;
* qué información ofrece cada una;
* qué generaciones cubren;
* qué sistemas cubren;
* qué información parece faltar.

Construye un mapa de cobertura.

Ejemplo:

```text
Source A
Pokémon        ✅
Moves          ✅
Cooldowns      ✅
Tiers          ✅
Hunts          ❌
Teleport       ❌

Source B
Pokémon        ✅
Moves          ❌
Hunts          ✅
Locations      ✅
```

Después empieza la investigación profunda.

---

# INVESTIGACIÓN DE POKÉMON

Investiga todas las especies y variantes disponibles públicamente.

Para cada variante intenta obtener:

```text
name
species
variant
generation

normal
shiny
mega
special form

nativeTypes

requiredLevel
tier

hp
other available stats

moves
moveElement
cooldown
area behavior
AoE
single target
CC
healing
defensive effects
buff
debuff

abilities / utilities

catchability
availability
locations

sources
lastVerifiedAt
```

No rellenes campos inexistentes.

---

# VARIANTES

Las variantes deben investigarse independientemente.

No asumas:

```text
Normal Pokémon moveset
=
Shiny Pokémon moveset
```

Tenemos evidencia de numerosos casos donde eso no ocurre.

Busca sistemáticamente diferencias entre:

```text
Normal
Shiny
Mega
Forms
Special variants
```

---

# INVESTIGACIÓN DE MOVES

Los moves son uno de los datasets más importantes.

Necesitamos conocer cuando sea públicamente posible:

```text
name
element
cooldown

AoE
single-target

area shape
area size
range

CC
stun
slow
fear
root
silence
knockback

heal
self-heal
shield
invulnerability

buff
debuff

multi-hit
channel
duration
```

No inventes propiedades que la fuente no revele.

---

# INVESTIGACIÓN ESPECIAL DE AoE

Para el proyecto no basta con saber el elemento de un Pokémon.

Debemos saber qué movimientos sirven realmente en hunts.

Prioriza especialmente identificar:

* AoE;
* cooldown;
* tamaño;
* facilidad de impactar una box;
* cantidad de AoE consecutivos;
* duración de la descarga completa.

Cuando no exista información suficiente:

```text
unknown
```

---

# INVESTIGACIÓN DE ROTACIONES

Construye progresivamente un dataset de:

```text
rotation_profiles
```

Una rotación NO es el tipo nativo del Pokémon.

Una rotación representa el elemento ofensivo que un Pokémon puede aportar eficazmente dentro de una hunt.

Ejemplos conocidos conceptualmente:

```text
Shiny Miltank
native: Normal
rotation: Rock
```

```text
Shiny Exploud
native: Normal
rotation: Ice
```

Analiza casos no obvios.

Busca específicamente:

* Castform;
* formas de Castform;
* Shiny Castform;
* Smeargle;
* variantes/configuraciones de Smeargle;
* Shiny Smeargle;
* Megas;
* Shinies cuyo elemento ofensivo cambia;
* Pokémon híbridos;
* Pokémon con suficientes AoE secundarios para participar en otra rotación.

---

# CRITERIO DE ROTACIÓN

No agregues un Pokémon a una rotación únicamente porque tenga un ataque aislado de ese elemento.

Evalúa:

```text
numberOfUsefulAoEs
cooldowns
AoEQuality
rotationDuration
burst
sustain
survivability
CC
utility
```

Puede existir:

```text
primaryRotation
secondaryRotation
```

y también:

```text
incidentalMoveElement
```

que NO debe considerarse una rotación.

---

# INVESTIGACIÓN DE TIERS

Obtén el sistema actual.

Registra:

* tier actual;
* variante;
* fuente;
* fecha.

Si una wiki comunitaria dice:

```text
Audino = T4
```

pero la fuente oficial actual dice:

```text
Audino = T2
```

conserva el conflicto histórico, pero:

```text
current canonical value = T2
```

Nunca sobrescribas silenciosamente.

---

# INVESTIGACIÓN DE SHINIES

Investiga:

* tiers;
* rarity;
* spawn systems;
* Wildscape;
* Áreas Primais;
* formas de aparición;
* proyectos Shiny;
* shards;
* mecanismos relacionados;
* restricciones.

Distingue siempre:

```text
T1
Super Rare
Ultra Rare
Legendary
Mythic
```

de “Pokémon legendario” en términos tradicionales.

---

# INVESTIGACIÓN DE HELDS

Investiga todos los tipos disponibles:

* X;
* Y;
* tiers;
* efectos;
* porcentajes;
* compatibilidades;
* obtención;
* restricciones.

Incluye sistemas como:

```text
X-Attack
X-Boost
X-Health
X-Defense
X-Lucky
X-Critical
X-Experience
X-Cooldown
...
```

Sólo si realmente existen actualmente.

---

# INVESTIGACIÓN DE LUCKY

Especialmente registra:

* qué modifica;
* fórmula;
* interacción con loot;
* momento en que se aplica;
* interacción con buffs;
* qué está confirmado actualmente;
* qué sólo aparece en código histórico.

---

# INVESTIGACIÓN DE UTILITIES

Investiga capacidades como:

```text
Teleport
Fly
Surf
Ride
Dig
Cut
Smash
Blink
Light
```

pero no infieras compatibilidad por reglas tradicionales de Pokémon.

Busca evidencia específica de PokeAlliance.

---

# INVESTIGACIÓN DE BOOST

Investiga:

* stones;
* tiers;
* recetas;
* materiales;
* costes;
* probabilidades;
* progresión;
* sistemas relacionados;
* límites;
* diferencias por elemento.

---

# INVESTIGACIÓN DE STARS

Investiga:

* Star Machine;
* tiers compatibles;
* bonus;
* requisitos;
* materiales;
* variantes especiales;
* Smeargle;
* restricciones.

---

# INVESTIGACIÓN DE POKÉBALLS

Investiga:

* balls disponibles;
* catch rates;
* bonificaciones;
* balls elementales;
* restricciones;
* fuentes;
* obtención.

No utilices automáticamente ratios de Pokémon oficial.

---

# INVESTIGACIÓN DE HUNTS

Investiga:

```text
hunt
location
region
requiredLevel

spawn composition
target Pokémon
target types

recommended attacking rotations
danger
access requirements

special mechanics
```

No confundas:

```text
NPC de task
```

con:

```text
respawn/hunt
```

---

# INVESTIGACIÓN DE LOCATIONS

Investiga:

* regiones;
* ciudades;
* islas;
* hunts;
* coordenadas cuando existan;
* accesos;
* requisitos;
* teleports;
* rutas;
* level restrictions.

---

# INVESTIGACIÓN DE ITEMS

Intenta construir catálogo estructurado:

```text
items
materials
loot
quest items
boost materials
held materials
balls
consumables
```

---

# INVESTIGACIÓN DE DROPS

Cuando la información exista:

```text
Pokemon
↓
loot table
↓
item
chance
quantity
```

Siempre registra la fuente.

---

# INVESTIGACIÓN DE QUESTS Y SISTEMAS

Investiga:

* quests;
* prerequisites;
* rewards;
* desbloqueos;
* tareas;
* dungeons;
* progression systems;
* achievements;
* mechanics importantes.

Especialmente registra prerequisitos porque posteriormente podremos construir árboles de progresión.

---

# INVESTIGACIÓN DE ECONOMÍA

Investiga sólo información verificable:

* CAC;
* moneda;
* sistemas de trading;
* market;
* restricciones;
* trading Pokémon;
* sistemas relacionados.

Esto será importante posteriormente para herramientas de economía y marketplace.

---

# INVESTIGACIÓN DE REGLAS DE COMERCIO

Investiga las reglas oficiales actuales relacionadas con:

* venta de Pokémon;
* CACs;
* intercambio;
* dinero real;
* publicidad;
* foro oficial;
* canales permitidos/prohibidos.

No conviertas ninguna regla actual en una constante permanente.

Guarda:

```text
rule
source
effectiveAt
verifiedAt
```

Las reglas cambian.

---

# MARKETPLACE RESEARCH

Aunque todavía NO vamos a construir el marketplace, identifica qué información real necesitará una publicación.

Ejemplo:

```text
Pokemon
variant
level
boost
stars
ball
heldX
heldY
```

Pero sólo conserva campos realmente utilizados por PokeAlliance.

No diseñes todavía la interfaz definitiva.

Primero descubre cómo se representa un Pokémon real dentro del juego.

---

# OTRAS ÁREAS

Durante la investigación debes buscar activamente sistemas que no estén enumerados aquí.

No asumas que esta lista es completa.

Si descubres:

* mecánicas importantes;
* sistemas de progresión;
* herramientas comunitarias;
* categorías de datos;
* conceptos necesarios para comprender el juego;

agrégalos al Research Plan.

El objetivo es descubrir también:

**“lo que todavía no sabemos que necesitamos saber”.**

---

# TRIANGULACIÓN

Cuando varias fuentes describan el mismo dato:

compáralas.

Ejemplo:

```text
Official Wiki
Shiny Pokémon = T1

Community Wiki
Shiny Pokémon = T2

Historical Code
pokemonRank = ...
```

No selecciones arbitrariamente una.

Registra:

```text
currentAcceptedValue
evidence
conflictingEvidence
reason
confidence
```

---

# CONFLICT REGISTRY

Crea:

```text
knowledge/research/conflicts/
```

o un dataset equivalente.

Cada conflicto importante debe contener:

```text
entity
field

sourceA
valueA

sourceB
valueB

resolution

reason

confidence
```

---

# KNOWLEDGE STATUS

Cada hecho importante debe poder tener:

```text
confirmed
probable
inferred
conflicting
unknown
obsolete
```

---

# NO INVENTAR

Esta regla tiene prioridad máxima.

Nunca rellenes datos faltantes basándote solamente en:

* Pokémon canon;
* Bulbapedia;
* Pokémon Showdown;
* conocimiento general;
* PXG;
* otro PokéTibia.

Esas fuentes pueden ayudar a generar hipótesis, pero NO establecen cómo funciona PokeAlliance.

---

# RAW RESEARCH

Si necesitamos conservar información extraída, mantén separación.

Ejemplo:

```text
data/
  raw/
  staging/
  normalized/
```

`raw` representa evidencia obtenida.

`staging` representa información interpretada temporalmente.

`normalized` representa datos que ya pasaron validación.

No copies y almacenes páginas enteras protegidas por copyright innecesariamente.

Prefiere:

* campos;
* hechos;
* metadata;
* URLs;
* hashes;
* extractos pequeños cuando sean necesarios.

---

# PROVENANCE

Todo dato importante debe poder responder:

> ¿De dónde salió esto?

Registra como mínimo:

```text
sourceId
sourceUrl
retrievedAt
confidence
```

y cuando corresponda:

```text
sourceVersion
page
section
```

---

# MACHINE-READABLE DATA

La investigación no debe terminar únicamente en archivos Markdown.

Produce datasets utilizables por software.

Ejemplo:

```text
data/normalized/
  pokemon.json
  pokemon-variants.json
  moves.json
  variant-moves.json
  tiers.json
  elements.json
  rotations.json
  rotation-profiles.json
  abilities.json
  locations.json
  hunts.json
  items.json
  sources.json
```

No es obligatorio utilizar exactamente estos archivos si un modelo mejor surge durante la investigación.

---

# SCHEMA VALIDATION

Define schemas.

Valida:

* IDs;
* enums;
* relaciones;
* URLs;
* fechas;
* valores desconocidos;
* source references.

Los datasets inválidos no deben pasar silenciosamente.

Durante esta fase puedes crear scripts de investigación/importación/validación si facilitan el trabajo.

**Eso no cuenta como empezar a construir la aplicación.**

---

# RESEARCH AUTOMATION

No recopiles manualmente cientos de entradas cuando la fuente tenga una estructura que pueda procesarse de forma razonable.

Construye pequeños importadores cuando sea apropiado.

Ejemplo:

```text
Official Pokédex
        ↓
extract
        ↓
normalize
        ↓
validate
        ↓
compare
        ↓
data/staging
```

Pero evita scraping destructivo o agresivo.

---

# COVERAGE REPORT

Crea:

```text
docs/RESEARCH_COVERAGE.md
```

Debe mostrar algo parecido a:

```text
Pokémon variants       96%
Tiers                  99%
Moves                  92%
Cooldowns              90%
AoE classification     65%
Hunts                  70%
Items                  55%
Abilities              45%
Teleport compatibility 20%
```

Los porcentajes deben basarse en cobertura real, no inventarse.

---

# RESEARCH LOG

Mantén:

```text
knowledge/research/RESEARCH_LOG.md
```

Registra:

* fuente investigada;
* fecha;
* qué aportó;
* qué contradicciones produjo;
* qué preguntas nuevas surgieron.

---

# UNKNOWN DATASET

Mantén explícitamente:

```text
data/normalized/unknowns.json
```

o una representación equivalente.

Esto es importante.

Una buena investigación no significa fingir que conocemos todo.

Quiero poder consultar posteriormente:

> ¿Qué datos importantes todavía no están confirmados?

---

# RESEARCH EXIT CRITERIA

NO empieces a construir la web sólo porque ya tengas “bastante información”.

La investigación inicial estará suficientemente madura cuando:

1. se hayan descubierto las principales fuentes públicas conocidas;
2. la wiki oficial haya sido investigada extensamente;
3. las principales wikis comunitarias hayan sido investigadas;
4. las principales herramientas comunitarias disponibles hayan sido analizadas;
5. repositorios públicos relevantes hayan sido analizados;
6. exista un Source Registry;
7. exista un Conflict Registry;
8. exista un Unknown Registry;
9. exista un Research Coverage Report;
10. existan datasets normalizados;
11. los datasets tengan schemas;
12. los datasets pasen validación;
13. los datos oficiales estén separados de datos comunitarios;
14. las inferencias estén explícitamente marcadas;
15. tiers y variantes no dependan de una única fuente comunitaria;
16. el modelo de movimientos contemple AoE y cooldowns;
17. el modelo permita rotaciones diferentes al tipo nativo;
18. se hayan investigado casos especiales como Castform y Smeargle;
19. exista suficiente comprensión del dominio para diseñar el modelo relacional sin hacerlo a ciegas;
20. las áreas incompletas estén documentadas explícitamente.

No es necesario que todo sea conocido al 100%.

Sí es obligatorio conocer claramente:

**qué sabemos, qué no sabemos, de dónde viene cada dato y qué tan confiable es.**

---

# PHASE 2 — DATA MODEL CONSOLIDATION

Sólo después de Phase 1.

Ahora revisa la propuesta arquitectónica original a la luz de la investigación.

No asumas que el modelo pensado antes de investigar sigue siendo correcto.

Rediseña si es necesario:

```text
docs/DATA_MODEL.md
docs/ARCHITECTURE.md
```

Convierte el conocimiento recopilado en el modelo definitivo que utilizará la aplicación.

Diseña:

* entidades;
* relaciones;
* constraints;
* índices;
* provenance;
* imports;
* synchronization.

Ahora sí diseña las migrations iniciales de Supabase.

---

# PHASE 3 — APPLICATION FOUNDATION

Sólo ahora comienza el desarrollo web.

Entonces:

1. inicializa Astro;
2. configura TypeScript;
3. configura React;
4. configura Tailwind;
5. configura shadcn/ui;
6. configura Supabase;
7. configura migraciones;
8. configura testing;
9. configura CI;
10. configura Vercel;
11. crea design system;
12. crea layouts;
13. crea navegación;
14. comienza Wiki Core.

En este punto la aplicación ya se construirá encima de información real y de un dominio comprendido.

---

# PHASE 4 — WIKI CORE

Construye inicialmente:

* Home;
* Pokédex;
* Pokémon Detail;
* Rotations;
* Tiers;
* Guides;
* Systems;
* Sources;
* Search.

Utiliza los datasets previamente investigados.

NO vuelvas a hardcodear información investigada directamente dentro de componentes.

---

# PHASE 5 — TOOLS

Después:

* Rotation Builder;
* Team Builder;
* Compare Pokémon;
* Tier Explorer;
* Hunt Finder;
* Boost Calculator;
* Material Calculator;
* Shiny tools;
* otras herramientas que surjan del research.

---

# PHASE 6 — ACCOUNTS

Después:

* Supabase Auth;
* profiles;
* favorites;
* saved teams;
* seller profiles.

---

# PHASE 7 — MARKETPLACE

Finalmente:

* Pokémon listings;
* CAC listings;
* seller profiles;
* listing media;
* reports;
* moderation;
* reputation;
* messaging si posteriormente aporta valor.

Antes de esta fase vuelve a verificar las reglas actuales de PokeAlliance.

---

# REGLA DE CONTROL PRINCIPAL

La existencia de una fase futura NO justifica implementarla anticipadamente.

Pero cada fase debe evitar decisiones que hagan imposible la siguiente.

---

# PRIMERA TAREA CONCRETA

Después de recibir este prompt:

## Haz exactamente esto primero:

1. inspecciona el repositorio;
2. NO inicialices todavía la aplicación;
3. crea el Master Plan;
4. crea el Research Plan;
5. crea la Data Strategy;
6. crea la Architecture Proposal;
7. crea Risks and Unknowns;
8. crea el AGENTS.md inicial;
9. revisa la consistencia de esos documentos;
10. cuando la planificación sea suficientemente sólida, inicia automáticamente Phase 1;
11. realiza la investigación profunda;
12. construye la base de conocimiento;
13. construye datasets estructurados;
14. valida los datasets;
15. genera el Coverage Report;
16. registra conflictos e incógnitas;
17. sólo después realiza Phase 2;
18. sólo después comienza a desarrollar Astro.

No empieces por una landing page.

No empieces por componentes visuales.

No empieces por Supabase.

No empieces por crear diez tablas basándote en suposiciones.

**Primero comprende PokeAlliance.**

Después diseña cómo representar PokeAlliance.

Después construye la plataforma.

