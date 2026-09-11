Quiero que construyas desde cero un proyecto web de producción, escalable y mantenible, cuyo nombre de trabajo será **PokeAlliance Wiki & Tools**. No debe considerarse una simple landing page, un prototipo o una demo visual: quiero construir una plataforma comunitaria real que pueda evolucionar durante años.

Antes de escribir código, analiza cuidadosamente todos los requisitos de este documento, define una arquitectura coherente y documenta las decisiones importantes. Después de planificar, **empieza a ejecutar el proyecto**. No te limites a devolverme un plan. Crea los archivos, configura el proyecto, instala únicamente las dependencias necesarias, implementa la primera arquitectura funcional, ejecuta validaciones y deja el proyecto en un estado utilizable.

Si alguna integración externa necesita una credencial que no tienes, no inventes credenciales ni te detengas innecesariamente. Prepara la integración correctamente, crea `.env.example`, documenta qué variable falta y continúa con todo lo que pueda desarrollarse sin ella.

# 1. Visión del producto

La plataforma estará dedicada a **PokeAlliance**, un servidor/juego de estilo PokéTibia.

El proyecto debe terminar combinando tres grandes áreas:

1. **Wiki y base de conocimiento del juego.**
2. **Herramientas interactivas para jugadores.**
3. **Marketplace comunitario futuro para compra/venta de Pokémon y CACs u otros activos permitidos por las reglas del servidor.**

Sin embargo, el orden de prioridad es obligatorio:

**Primero construir una base de conocimiento sólida y una wiki excelente.**

Después se desarrollarán herramientas.

Después autenticación y funcionalidades sociales.

Finalmente marketplace.

No intentes construir todo al mismo tiempo.

La arquitectura, sin embargo, debe quedar preparada desde el principio para que esas etapas futuras no obliguen a rehacer la aplicación.

# 2. Principio fundamental del proyecto

La información es más importante que la interfaz.

Antes de llenar la web de páginas o crear cientos de componentes visuales, necesitamos construir una **base de conocimiento verificable, estructurada, trazable y apta tanto para la aplicación como para agentes de IA**.

La IA que trabaje en este proyecto debe poder conocer:

* qué fuentes existen;
* qué fuentes son oficiales;
* qué fuentes son comunitarias;
* qué datos están confirmados;
* qué datos son inferidos;
* qué información puede estar desactualizada;
* cuándo se verificó un dato;
* qué reglas propias de PokeAlliance hay que respetar;
* cómo funciona nuestra clasificación de Pokémon;
* cómo interpretamos tiers, variantes, movesets, rotaciones, hunts, etc.

Nunca rellenes información faltante con conocimiento general de Pokémon.

**PokeAlliance tiene reglas, movesets, tiers, variantes y sistemas propios.**

Si un dato específico de PokeAlliance no está verificado:

* utiliza `null`, `unknown` o un estado equivalente;
* marca la información como pendiente;
* conserva la fuente;
* nunca inventes un valor simplemente porque así funciona Pokémon tradicional.

# 3. Stack obligatorio

Utiliza un stack pequeño, moderno y justificable.

No introduzcas tecnologías porque sean populares si no aportan valor real.

## Core

* **Astro**
* **TypeScript con strict mode**
* **React** exclusivamente para componentes o herramientas que realmente necesiten interactividad en cliente
* **Tailwind CSS**
* **shadcn/ui**
* **pnpm**

## Backend y datos

* **Supabase**

  * PostgreSQL
  * Supabase Auth
  * Data API
  * Row Level Security
  * Supabase Storage cuando sea necesario
* `@supabase/supabase-js`
* solución SSR de Supabase recomendada actualmente para Astro cuando sea necesaria
* **Zod** para validación de datos, formularios y entradas del servidor
* migraciones SQL reproducibles mediante Supabase CLI

No introduzcas inicialmente:

* Prisma
* Drizzle
* Redux
* GraphQL
* microservicios
* Redis
* Elasticsearch
* Meilisearch
* Turso
* otro backend independiente
* otro proveedor de autenticación
* otro storage
* un monorepo

Sólo deben añadirse posteriormente si existe una necesidad concreta y documentada.

## Hosting

* **Vercel**

Utiliza la integración/adaptador oficial actual de Astro para Vercel cuando sea necesario renderizar rutas dinámicas.

La mayoría de la wiki debe prerenderizarse siempre que sea posible.

Las rutas que realmente necesiten sesión, usuario o información dinámica pueden renderizarse bajo demanda.

## Calidad

Configura:

* ESLint
* Prettier
* soporte apropiado para Astro
* Vitest
* Playwright

No persigas una cifra artificial de cobertura. Los tests deben concentrarse en lógica importante.

# 4. Filosofía Astro

Astro debe aprovecharse correctamente.

No conviertas toda la aplicación en React.

Una página como:

`/pokemon/shiny-magneton`

debe poder ser mayoritariamente HTML generado por Astro.

React sólo debe utilizarse para cosas como:

* filtros complejos;
* comparadores;
* team builders;
* calculadoras;
* selectores;
* interfaces que requieran estado;
* marketplace dinámico;
* componentes personales del usuario.

Evita enviar JavaScript al navegador donde no sea necesario.

Utiliza hidratación selectiva.

No utilices `client:load` indiscriminadamente.

Elige `client:visible`, `client:idle`, server islands u otras estrategias cuando tengan sentido.

# 5. Organización del repositorio

Propón la estructura definitiva después de analizarla, pero quiero una separación clara similar conceptualmente a ésta:

```text
src/
  components/
    ui/
    layout/
    common/

  features/
    pokemon/
    rotations/
    hunts/
    search/
    auth/
    marketplace/
    tools/

  content/
    guides/
    systems/
    mechanics/

  lib/
    supabase/
    auth/
    validation/
    domain/
    sources/

  pages/

  styles/

  types/

knowledge/
  README.md
  sources/
  mechanics/
  research/
  rules/

data/
  normalized/
  fixtures/

scripts/
  imports/
  validation/

supabase/
  migrations/
  seed.sql
  tests/

docs/
  ARCHITECTURE.md
  DATA_MODEL.md
  SECURITY.md
  ROADMAP.md
  DEVELOPMENT.md

AGENTS.md
README.md
CHANGELOG.md
```

No sigas esta estructura ciegamente si encuentras una organización mejor, pero mantén las responsabilidades bien separadas.

Prefiere organización por features donde tenga sentido.

# 6. AGENTS.md

Crea un `AGENTS.md` importante y útil.

Debe ser una guía para cualquier IA futura que modifique este proyecto.

Como mínimo debe explicar:

* objetivo del proyecto;
* stack;
* arquitectura;
* convenciones;
* prioridad de las fuentes;
* reglas de datos;
* reglas de seguridad;
* cómo agregar nuevas entidades;
* cómo agregar nuevas migraciones;
* cómo validar información;
* qué significa una rotación;
* qué cosas una IA NO debe asumir;
* comandos disponibles;
* proceso antes de hacer cambios importantes.

La IA debe leer `AGENTS.md` antes de realizar trabajo sustancial.

# 7. Base de conocimiento

Crea una carpeta `knowledge/`.

No debe ser contenido improvisado.

Debe funcionar como documentación de dominio para humanos y agentes de IA.

Ejemplos:

```text
knowledge/
  README.md

  sources/
    official.md
    community.md
    historical-code.md

  mechanics/
    tiers.md
    variants.md
    rotations.md
    shinies.md
    helds.md
    boost.md
    star-machine.md

  research/
    teleport.md
    lucky-held.md
    rotation-classification.md

  rules/
    data-confidence.md
    source-priority.md
```

No copies páginas completas de terceros.

Guarda:

* hechos estructurados;
* explicaciones propias;
* enlaces;
* fecha de consulta;
* conclusiones;
* conflictos detectados.

# 8. Fuentes conocidas inicialmente

Crea un registro de fuentes extensible.

Fuentes iniciales conocidas:

## Oficial

PokeAlliance Wiki:

`https://wiki.pokealliance.com`

Pokédex:

`https://wiki.pokealliance.com/pokemon`

Tiers especiales de Shiny:

`https://wiki.pokealliance.com/guias/tiers-de-shiny`

Star Machine:

`https://wiki.pokealliance.com/sistemas/star-machine`

Teleport:

`https://wiki.pokealliance.com/tutoriais/como-usar-tp`

Guías oficiales adicionales deben incorporarse conforme se descubran.

## Comunidad

Wiki comunitaria:

`https://pokealliance-wiki.vercel.app`

Repositorio:

`https://github.com/thiagobfo/pokealliance-wiki`

## Código histórico / investigación

`https://github.com/tanjirokamadoserver/PokeMonster`

Esta última fuente **NO debe tratarse como el código actual confirmado de PokeAlliance**.

Sólo sirve como:

* evidencia histórica;
* pista de implementación;
* material de investigación.

Nunca utilices datos de ese repositorio para afirmar automáticamente cómo funciona actualmente PokeAlliance.

# 9. Jerarquía de confianza de fuentes

Utiliza una clasificación explícita.

Orden conceptual:

1. información oficial actual de PokeAlliance;
2. evidencia directa dentro del juego;
3. anuncios o documentación oficial;
4. información comunitaria verificada;
5. wiki o herramientas comunitarias;
6. código histórico relacionado;
7. inferencias;
8. información desconocida.

Cada dato relevante debe poder almacenar procedencia.

Estados sugeridos:

```text
official
ingame_verified
community_verified
community
historical
inferred
unknown
```

No mezcles estos estados.

# 10. Modelo de Pokémon

No modeles un Pokémon únicamente como nombre + tipo + tier.

Necesitamos distinguir:

* especie;
* variante;
* shiny;
* mega;
* otras formas;
* tier;
* nivel requerido;
* estadísticas conocidas;
* tipos nativos;
* moveset;
* elemento de cada movimiento;
* cooldown;
* si es AoE;
* forma del AoE cuando sea conocida;
* roles;
* utilidades;
* capacidades;
* ubicación;
* disponibilidad;
* fuentes;
* fecha de verificación.

Una variante debe poder ser funcionalmente muy diferente de su versión normal.

Por ejemplo, conceptualmente:

* Magneton y Shiny Magneton pueden servir para rotaciones diferentes.
* Miltank y Shiny Miltank no deben asumirse equivalentes.
* Exploud y Shiny Exploud no deben asumirse equivalentes.
* Houndoom y Shiny Houndoom no deben asumirse equivalentes.
* Xatu y Shiny Xatu no deben asumirse equivalentes.
* Castform puede tener formas/configuraciones relevantes distintas.
* Smeargle puede necesitar representar diferentes configuraciones/movesets.

# 11. Concepto central: ROTACIÓN

Dentro de este proyecto no quiero que clasifiquemos Pokémon sólo por su tipo nativo.

Debemos tener una entidad/concepto de **rotación ofensiva**.

Una rotación representa el elemento con el cual un Pokémon puede aportar una fase útil de combate dentro de una hunt.

Ejemplo:

```text
Shiny Miltank

nativeTypes:
Normal

usefulRotation:
Rock
```

Otro ejemplo conceptual:

```text
Shiny Exploud

nativeTypes:
Normal

usefulRotation:
Ice
```

Un Pokémon puede pertenecer a más de una rotación si realmente tiene suficiente utilidad ofensiva en ambas.

NO lo incluyas en una rotación sólo porque posee un movimiento aislado de ese elemento.

# 12. Cómo evaluar una rotación

El sistema debe estar preparado para evaluar:

* cantidad de AoEs útiles del elemento;
* cooldowns;
* cobertura;
* tamaño/forma del área;
* burst;
* sustained damage;
* tiempo de ejecución de la rotación;
* supervivencia;
* CC;
* invulnerabilidades;
* curación;
* sustain;
* utilidad;
* tier;
* accesibilidad;
* coste;
* sinergia con otros integrantes.

Casos como:

* Castform Ice;
* Shiny Castform;
* Smeargle configurado para Ice;
* Shiny Smeargle;
* Pokémon con tipo nativo diferente pero múltiples AoE del elemento;

deben ser posibles en el modelo.

# 13. Tiers

No hardcodees el orden de tier de manera descontrolada por toda la aplicación.

Debe existir una entidad/configuración centralizada.

La lógica debe soportar al menos categorías conocidas como:

```text
T7
T6
T5
T4
T3
T2
T1
Super Rare
Ultra Rare
Legendary
Mythic
```

Pero debe poder adaptarse si PokeAlliance modifica el sistema.

Cuando se diga:

**“T1 o superior”**

normalmente significa:

```text
T1
Super Rare
Ultra Rare
Legendary
Mythic
```

# 14. Roles tácticos

La arquitectura puede soportar roles como:

* Tank
* Off-Tank
* Burst DPS
* Sustained DPS
* Support
* Controller / CC
* Mobility / Utility

Pero estas clasificaciones pueden ser inferidas y deben almacenar su grado de confianza.

No las presentes como “oficiales” salvo que exista una fuente oficial.

# 15. Datos normalizados

Quiero mantener una capa de datos legible por agentes de IA además de PostgreSQL.

Por ejemplo:

```text
data/normalized/
  pokemon/
  moves/
  tiers/
  elements/
  rotations/
```

No hace falta crear 900 archivos manualmente desde el primer día.

Diseña scripts capaces de importar, transformar y validar información.

El objetivo es poder ejecutar conceptualmente:

```bash
pnpm data:validate
pnpm data:sync
```

Los nombres exactos pueden cambiar.

# 16. Importadores

Diseña importadores por fuente.

Ejemplo:

```text
scripts/imports/
  official-wiki/
  community-wiki/
```

Cada importador debe:

1. obtener información;
2. normalizarla;
3. validar schema;
4. detectar diferencias;
5. registrar la fuente;
6. evitar sobrescribir silenciosamente datos de mayor autoridad;
7. producir logs legibles;
8. fallar de manera segura.

No hagas scraping agresivo.

Respeta límites, robots, términos y disponibilidad de las fuentes.

No descargues repetidamente información que no cambió.

Considera hashes o timestamps para detectar cambios.

# 17. Base de datos

Diseña PostgreSQL correctamente.

No hace falta crear todas estas tablas inmediatamente, pero el modelo debe contemplar aproximadamente:

```text
sources
pokemon_species
pokemon_variants
tiers
elements
pokemon_native_elements
moves
variant_moves
rotations
variant_rotation_profiles
roles
variant_roles
abilities
variant_abilities
locations
hunts
hunt_encounters
items
held_items
profiles
seller_profiles
```

No crees una tabla gigante `pokemon` con JSON arbitrario para todo.

Utiliza JSONB únicamente donde sea realmente apropiado.

Prefiere relaciones reales para datos que necesitemos consultar/filter.

Crea índices sólo donde exista un patrón de consulta claro.

# 18. Procedencia de información

La procedencia debe existir a nivel suficientemente granular.

Por ejemplo:

* tier de Shiny Magneton puede provenir de una fuente;
* moveset puede provenir de otra;
* clasificación “Electric rotation” puede ser una conclusión nuestra.

No basta con poner una única propiedad `source` al Pokémon entero si distintos campos provienen de lugares distintos.

Diseña una solución práctica sin convertir el esquema en un sistema EAV imposible de mantener.

# 19. Wiki

Las páginas de contenido deben ser rápidas, indexables y útiles.

Categorías futuras:

* Pokémon
* tiers
* shinies
* rotaciones
* moves
* helds
* boost
* items
* hunts
* mapas
* ciudades
* NPC
* quests
* sistemas
* profesiones
* guías

Utiliza Astro Content Collections para contenido editorial cuando tenga sentido.

Datos relacionales del juego deben venir de la capa estructurada.

# 20. Pokédex

La Pokédex será una de las herramientas centrales.

Debe quedar preparada para filtros como:

* nombre;
* generación;
* tier;
* variante;
* Shiny;
* Mega;
* nivel;
* tipo nativo;
* rotación;
* rol;
* número de AoE;
* CC;
* utilidad;
* disponibilidad.

No cargues 900 componentes React pesados si no hace falta.

Diseña una estrategia de búsqueda/filtro eficiente.

No instales un motor externo de búsqueda todavía.

Empieza simple y permite evolucionar a PostgreSQL Full Text Search si aparece la necesidad.

# 21. Página individual de Pokémon

Debe tener una arquitectura visual reutilizable.

Conceptualmente:

* nombre;
* arte/sprite;
* variante;
* tier;
* tipos nativos;
* rotaciones;
* nivel requerido;
* stats disponibles;
* moveset;
* cooldown;
* elemento;
* indicador AoE;
* utilidad;
* roles;
* disponibilidad;
* ubicaciones;
* fuentes;
* última verificación.

Debe diferenciar visualmente:

**información oficial**

de:

**clasificación comunitaria**

e:

**inferencia propia**.

# 22. Diseño

Quiero un diseño de producción.

No quiero una interfaz que “cante IA”.

Evita:

* tarjetas innecesarias;
* cajas dentro de cajas;
* textos explicativos obvios;
* subtítulos que sólo repiten el título;
* gradientes aleatorios;
* glassmorphism indiscriminado;
* exceso de badges;
* espacios gigantes sin función;
* enormes hero sections sin contenido;
* elementos decorativos que dificulten consultar información.

La wiki debe sentirse:

* moderna;
* limpia;
* rápida;
* técnica cuando haga falta;
* relacionada visualmente con videojuegos/Pokémon;
* pero suficientemente profesional para consultar mucha información.

Diseña primero un sistema visual.

Utiliza:

* tokens;
* variables CSS;
* escalas consistentes;
* tipografía consistente;
* spacing consistente;
* border radius consistente;
* estados hover/focus consistentes.

Tailwind debe ser la herramienta principal de estilos.

No utilices `style=""` de forma habitual.

No introduzcas CSS inline salvo una razón técnica real.

No copies y pegues grandes bloques de clases idénticas.

Extrae patrones reutilizables cuando realmente representen un componente.

# 23. Componentización

Todo debe estar correctamente componentizado.

Sin embargo, evita ambos extremos:

NO quiero componentes monolíticos de 1,000 líneas.

Tampoco quiero un componente nuevo para cada `<div>`.

Divide por responsabilidad y reutilización real.

Ejemplos:

```text
PokemonCard
PokemonTierBadge
ElementBadge
RotationBadge
MoveTable
MoveRow
SourceBadge
SourceList
PokemonFilters
PokemonSearch
```

La lógica de dominio no debe vivir enterrada dentro de componentes visuales.

# 24. TypeScript

Utiliza `strict`.

Evita:

* `any`;
* casts innecesarios;
* `as unknown as`;
* non-null assertions indiscriminadas;
* objetos sin tipar;
* duplicación de interfaces equivalentes.

Centraliza los tipos del dominio.

Genera los tipos de Supabase cuando corresponda.

# 25. Validación

Toda entrada de usuario debe validarse también en servidor.

No confíes en validación cliente.

Utiliza Zod donde sea apropiado.

Esto incluye en el futuro:

* perfil;
* publicación;
* precio;
* descripción;
* contacto;
* imágenes;
* filtros complejos;
* endpoints internos.

# 26. Autenticación

La wiki pública NO debe requerir login.

Supabase Auth será la única autenticación inicial.

Utiliza la estrategia SSR/cookies actualmente recomendada por Supabase para Astro.

Inicialmente debe poder soportar:

* registro;
* login;
* logout;
* recuperación de contraseña;
* verificación de correo.

Más adelante puede agregarse Discord OAuth.

No almacenes contraseñas manualmente.

No construyas un sistema casero de sesiones.

# 27. Usuarios

Modelo conceptual:

```text
auth.users
    ↓
profiles
```

Todo usuario autenticado es un miembro normal.

No crees innecesariamente roles separados `buyer` y `seller`.

Un comprador puede ser cualquier usuario registrado.

Si alguien quiere vender, puede crear un:

```text
seller_profile
```

Roles administrativos separados pueden ser:

```text
user
moderator
admin
```

Utiliza capacidades y RLS en vez de confiar exclusivamente en valores enviados por el frontend.

# 28. Marketplace futuro

NO construyas el marketplace completo durante la primera fase.

Pero diseña sin bloquearlo.

En el futuro deberá permitir al menos:

## Venta de Pokémon

Un vendedor podrá publicar un Pokémon con información real del juego.

La publicación debería poder representar visualmente el Pokémon de una forma cercana a cómo se muestra dentro del juego.

Debe poder almacenar de manera estructurada datos como los que realmente existan en PokeAlliance, por ejemplo:

* variante;
* level;
* boost;
* stars;
* Pokéball;
* Held X;
* Held Y;
* atributos relevantes;
* información adicional real del juego.

NO inventes campos antes de investigar exactamente qué muestra PokeAlliance.

## Venta de CACs

Debe poder existir otra categoría de publicación para CACs/dinero dentro del juego, siempre que esto continúe siendo permitido por las reglas del servidor.

No codifiques como verdad permanente una regla comunitaria actual.

Las reglas pueden cambiar.

Debe existir documentación de la fuente y fecha de verificación.

## Marketplace conceptual

Tablas futuras:

```text
seller_profiles
marketplace_listings
listing_pokemon_data
listing_media
listing_reports
favorites
```

Messaging/reputación pueden incorporarse posteriormente.

# 29. Seguridad del marketplace

Cuando llegue esta fase:

* los usuarios sólo pueden modificar sus propias publicaciones;
* moderadores pueden moderarlas;
* administradores pueden administrarlas;
* usuarios suspendidos no deben publicar;
* imágenes deben validarse;
* textos deben sanitizarse;
* deben existir límites de tamaño;
* deben existir reportes;
* deben existir logs de moderación;
* no publiques el email privado de un usuario;
* los métodos de contacto deben ser configurables;
* cualquier sistema de pago futuro debe utilizar un proveedor especializado.

Nunca almacenes números de tarjeta.

# 30. Row Level Security

RLS es obligatorio.

Toda tabla expuesta por Supabase debe revisarse.

No dejes una tabla nueva públicamente escribible accidentalmente.

Define explícitamente:

* grants;
* SELECT;
* INSERT;
* UPDATE;
* DELETE.

Ejemplo conceptual:

```text
profiles:
public select limitado
owner update

marketplace_listings:
public select only published
owner insert/update own listings
moderator moderation rights

seller_profiles:
public selected fields
owner update own profile
```

Crea tests de RLS para operaciones sensibles.

El `service_role` jamás debe aparecer en código cliente.

# 31. Secrets

Nunca commits:

* Supabase secret/service-role key;
* tokens Vercel;
* SMTP credentials;
* OAuth secrets;
* CRON_SECRET;
* cualquier credencial.

Utiliza variables de entorno.

Crea `.env.example`.

Diferencia claramente variables públicas y server-only.

# 32. Seguridad web

Configura headers de seguridad apropiados.

Evalúa e implementa razonablemente:

* Content-Security-Policy;
* HSTS en producción;
* `X-Content-Type-Options`;
* `Referrer-Policy`;
* `Permissions-Policy`;
* protección contra framing mediante CSP;
* cookies seguras;
* SameSite adecuado.

Evita XSS.

No utilices HTML de usuarios directamente.

Si en el futuro existe rich text, sanitízalo.

Utiliza consultas parametrizadas / APIs seguras.

# 33. Rate limiting

No pongas un rate limit absurdo sobre las páginas públicas.

Un usuario debe poder navegar rápidamente entre páginas de la wiki sin ser castigado.

La navegación estática debe beneficiarse del CDN.

Aplica límites principalmente a:

* login;
* signup;
* recuperación;
* creación de publicaciones;
* edición;
* mensajes;
* uploads;
* endpoints costosos;
* acciones administrativas.

Para Auth utiliza primero las protecciones nativas de Supabase.

Cuando el proyecto sea público activa protección anti-bot adecuada, preferiblemente Cloudflare Turnstile si encaja con la configuración disponible.

En Vercel utiliza Firewall/WAF con reglas específicas para endpoints sensibles cuando sea apropiado.

No añadas Redis inicialmente sólo para implementar rate limiting.

# 34. Uploads

Cuando el marketplace utilice Supabase Storage:

* valida MIME;
* valida extensión;
* valida tamaño;
* limita cantidad;
* genera nombres seguros;
* evita path traversal;
* configura Storage RLS;
* define ownership;
* elimina archivos huérfanos;
* nunca confíes sólo en la extensión proporcionada por el usuario.

# 35. Rendimiento

La aplicación debe estar pensada para miles de usuarios sin desperdiciar recursos.

Prioridades:

1. contenido estático cuando sea posible;
2. CDN;
3. mínimo JavaScript cliente;
4. imágenes optimizadas;
5. consultas eficientes;
6. índices apropiados;
7. paginación;
8. evitar N+1;
9. evitar fetch duplicado;
10. evitar hidratación innecesaria.

No uses SSR para una página que podría generarse una vez y servirse estáticamente.

# 36. Imágenes

No guardes blobs de imágenes dentro de PostgreSQL.

Assets propios de la wiki pueden vivir inicialmente como assets estáticos cuando sea apropiado.

Uploads de usuarios irán posteriormente a Supabase Storage.

Utiliza:

* tamaños adecuados;
* lazy loading;
* formatos modernos cuando sea posible;
* dimensiones explícitas para evitar layout shift.

# 37. Accesibilidad

Mínimo:

* HTML semántico;
* navegación por teclado;
* focus visible;
* labels;
* alt text;
* contraste;
* botones reales para acciones;
* links reales para navegación;
* estados disabled correctos;
* reduced-motion cuando corresponda.

No sacrifiques accesibilidad por estética.

# 38. Responsive

El proyecto debe funcionar correctamente en:

* móvil;
* tablet;
* laptop;
* desktop grande.

La Pokédex puede ser más densa en desktop.

En móvil adapta tablas y filtros adecuadamente.

No simplemente reduzcas toda la interfaz hasta que “quepa”.

# 39. SEO

Wiki pública orientada a SEO.

Implementa una base correcta para:

* title;
* meta description;
* canonical;
* Open Graph;
* sitemap;
* robots;
* slugs estables;
* breadcrumbs;
* páginas 404;
* enlaces internos.

No generes contenido SEO vacío o repetitivo.

# 40. Búsqueda

La arquitectura debe permitir búsqueda global futura:

```text
Pokémon
guías
items
hunts
quests
NPC
```

No introduzcas Algolia u otro servicio todavía.

Empieza por una solución suficientemente sencilla.

Cuando la escala lo justifique, PostgreSQL Full Text Search es el primer candidato.

# 41. Keep-alive / mantenimiento Supabase

Los proyectos gratuitos de Supabase pueden pausarse por baja actividad.

Configura una tarea ligera en Vercel que pueda generar actividad periódica de forma legítima y además realizar mantenimiento mínimo.

NO debe ser una tarea pesada.

Puede realizar, por ejemplo:

```text
health check database
source status
update last_checked_at
```

Protege el endpoint con `CRON_SECRET`.

No expongas un endpoint administrativo abierto.

La tarea debe tener una frecuencia razonable y fácilmente configurable en código.

No la presentes como garantía contractual de que Supabase jamás pausará el proyecto; monitoriza advertencias del proveedor.

# 42. Estado de fuentes

Sería útil poder mantener:

```text
sources
  name
  url
  type
  authority
  status
  last_checked_at
  last_success_at
  notes
```

Esto permitirá saber cuándo una wiki comunitaria, endpoint o repositorio deja de estar disponible.

# 43. Herramientas futuras

Diseña la navegación y arquitectura para incorporar herramientas como:

* Team Builder;
* Rotation Builder;
* comparador de Pokémon;
* Tier Explorer;
* calculadora de boost;
* calculadora de materiales;
* buscador de hunts;
* recomendador por elemento/rotación;
* filtros de proyectos Shiny;
* calculadoras de effectiveness;
* análisis de equipos.

Cada herramienta debe vivir como feature aislada.

No conviertas todo en una SPA gigantesca.

# 44. Rotations Builder

Una herramienta futura muy importante permitirá elegir:

```text
Rotation: Ice
Tier mínimo: T1
AoE mínimo: 3
```

y recibir candidatos reales.

Debe poder mostrar casos no obvios como:

* Pokémon cuyo tipo nativo no es Ice;
* variantes Shiny con moveset diferente;
* Castform;
* Smeargle;
* Megas;
* excepciones de tier inferior especialmente útiles.

Por eso este concepto debe existir correctamente desde el dominio.

# 45. Fuentes visibles al usuario

Cuando sea útil, las fichas deben mostrar:

```text
Official
Community
In-game verified
Inferred
```

No conviertas esto en ruido visual.

Utiliza badges discretos y una sección “Fuentes”.

# 46. Administración futura

La arquitectura puede permitir un panel administrativo posteriormente para:

* revisar cambios de datos;
* aprobar información comunitaria;
* revisar conflictos;
* administrar vendedores;
* moderar listings;
* suspender usuarios;
* revisar reportes.

No construyas un CMS gigante ahora.

# 47. Desarrollo

Buenas prácticas obligatorias:

* no código duplicado importante;
* funciones pequeñas con responsabilidad clara;
* nombres descriptivos;
* no magic numbers;
* no magic strings;
* constantes de dominio centralizadas;
* imports limpios;
* paths aliases razonables;
* manejo explícito de errores;
* loading states;
* empty states;
* error states;
* accesibilidad;
* no silencenciar errores.

# 48. Manejo de errores

Los errores internos no deben mostrar stack traces al usuario.

Logs server-side sí deben conservar contexto técnico.

La interfaz debe mostrar mensajes útiles.

Nunca hagas:

```ts
catch {
  return null
}
```

cuando eso oculte un problema importante.

# 49. Dependencias

Antes de instalar una dependencia pregúntate:

**¿Esto resuelve un problema que no podemos resolver razonablemente con el stack actual?**

No agregues una dependencia por una utilidad trivial.

Prefiere APIs nativas cuando sean suficientes.

Mantén lockfile versionado.

Utiliza versiones estables compatibles actuales, no versiones beta sin razón.

# 50. Git

Utiliza Git correctamente.

Flujo recomendado:

```text
main → producción

feature/* → cambios
fix/* → correcciones
chore/* → mantenimiento
```

No necesitamos una rama `develop` permanente inicialmente.

Cada feature importante debe poder revisarse mediante diff/PR.

# 51. CI

Configura GitHub Actions para ejecutar al menos:

```text
install
lint
format/check
typecheck
unit tests
build
```

Playwright puede ejecutarse en flujos relevantes.

Un PR que no compila no debe considerarse listo.

# 52. Vercel

Conecta el proyecto con Vercel cuando tengas autorización disponible.

Configuración deseada:

```text
feature branch / PR
    ↓
Preview Deployment

main
    ↓
Production Deployment
```

No crees un GitHub Action redundante para desplegar si la integración Git nativa de Vercel ya hace el trabajo correctamente.

Utiliza GitHub Actions principalmente para CI.

Configura variables por entorno.

Nunca hagas que previews escriban accidentalmente sobre datos de producción.

# 53. Releases

Aunque sea una aplicación web, quiero releases reales.

Utiliza Semantic Versioning de forma razonable.

Mantén:

`CHANGELOG.md`

Cuando una versión se considere estable:

* tag Git;
* GitHub Release;
* resumen de cambios;
* migraciones relevantes;
* breaking changes;
* instrucciones especiales si existen.

No hagas una release por cada commit.

# 54. Migraciones

Toda modificación estructural de DB debe ser reproducible.

Nunca dependas de:

“lo cambié manualmente en Supabase Dashboard”.

Debe existir una migration correspondiente.

Antes de una migración destructiva:

* analiza impacto;
* conserva datos;
* crea estrategia de transición;
* documenta rollback cuando sea razonable.

# 55. Seeds

Crea seeds pequeños y confiables.

No uses información falsa mezclada con producción.

Fixtures de tests deben estar claramente separadas.

# 56. Entornos

Diferencia:

```text
local
preview/staging
production
```

Idealmente el desarrollo local puede utilizar Supabase local.

Nunca permitas que tests destructivos corran contra producción.

# 57. Logs y observabilidad

Inicialmente utiliza bien:

* Vercel logs;
* Supabase logs;
* errores estructurados.

No instales Sentry automáticamente.

Añádelo cuando exista una necesidad real de observabilidad centralizada.

# 58. Privacidad

Recoge la menor cantidad posible de información personal.

No hagas público:

* email;
* IDs internos;
* información sensible.

Un perfil público puede tener:

* username;
* avatar;
* nombre visible;
* bio;
* seller profile;
* métodos de contacto elegidos explícitamente.

# 59. Marketplace y reglas del juego

El marketplace debe describirse como comunitario.

No debe implicar que sea el marketplace oficial de PokeAlliance salvo autorización explícita.

Incluye espacio futuro para:

* términos;
* disclaimer;
* política de privacidad;
* reglas de publicaciones.

Si se implementan transacciones reales en dinero, antes de lanzarlas revisa:

* reglas actuales de PokeAlliance;
* términos del hosting;
* proveedor de pagos;
* requisitos legales aplicables.

# 60. Branding

No asumas que podemos utilizar libremente cualquier asset propietario.

La plataforma puede estar inspirada visualmente por el universo del juego, pero debe tener una identidad de producto propia.

Conserva procedencia de assets cuando sea necesario.

# 61. Idioma

Inicialmente la interfaz y contenido pueden estar en español.

No construyas un sistema i18n completo todavía.

Sin embargo, evita hardcodear cientos de strings de UI de forma que resulte imposible añadir portugués posteriormente.

# 62. No quiero sobreingeniería

Evita explícitamente:

* microservicios;
* event buses;
* CQRS;
* DDD ceremonioso;
* Repository Pattern sin necesidad;
* Dependency Injection framework;
* interfaces que sólo tienen una implementación;
* 15 capas para hacer un SELECT;
* abstracciones prematuras.

La arquitectura debe ser profesional, no académicamente complicada.

# 63. No quiero deuda de prototipo

Tampoco quiero:

* todo en `index.astro`;
* componentes de 800 líneas;
* CSS inline;
* datos hardcodeados por todas partes;
* claves en código;
* fetch dentro de cualquier componente;
* queries duplicadas;
* lógica de negocio dentro de JSX;
* rutas inconsistentes;
* nombres temporales que luego nunca se cambian;
* mock data mezclada con producción.

# 64. Design review

Antes de declarar una pantalla terminada revisa:

* jerarquía;
* legibilidad;
* densidad;
* espaciado;
* responsive;
* estados;
* accesibilidad;
* consistencia;
* si algún texto sobra;
* si alguna tarjeta sobra;
* si parece una interfaz real o una interfaz generada automáticamente.

# 65. Performance review

Antes de declarar una feature terminada revisa:

* JavaScript enviado;
* queries;
* imágenes;
* hydration;
* re-renders;
* N+1;
* tamaño de bundle;
* network requests;
* caché.

# 66. Security review

Antes de publicar una feature que escriba datos revisa:

* autenticación;
* autorización;
* RLS;
* validation;
* rate limits;
* ownership;
* CSRF cuando aplique;
* XSS;
* uploads;
* secretos;
* errores;
* logs.

# 67. Definition of Done

Una feature NO está terminada únicamente porque “se ve”.

Debe:

* funcionar;
* estar tipada;
* ser responsive;
* ser accesible;
* manejar errores;
* estar integrada con arquitectura;
* no introducir secretos;
* no romper tests;
* compilar;
* pasar lint;
* tener documentación si cambia el dominio;
* actualizar migraciones si corresponde.

# 68. Roadmap

Crea `docs/ROADMAP.md`.

Divide aproximadamente:

## Phase 0 — Foundation

* Astro
* React integration
* Tailwind
* shadcn
* TypeScript
* estructura
* documentación
* AGENTS
* Vercel
* Supabase
* CI
* design system

## Phase 1 — Knowledge Base

* source registry
* source confidence
* normalized data schemas
* import architecture
* primeras fuentes
* validadores
* documentación del dominio

## Phase 2 — Wiki Core

* home
* navegación
* Pokédex
* Pokémon detail
* tiers
* rotations
* guides
* sources
* búsqueda inicial

## Phase 3 — Tools

* filters avanzados
* comparison
* rotation builder
* team builder
* calculators
* hunts

## Phase 4 — Accounts

* Auth
* profiles
* favorites
* saved teams
* seller profiles

La infraestructura de Auth puede prepararse antes si resulta conveniente, pero no debe distraer del objetivo principal.

## Phase 5 — Marketplace

* Pokémon listings
* CAC listings
* seller profiles
* favorites
* reports
* moderation
* seguridad
* reputación/messaging sólo después si aporta valor

# 69. Primera ejecución que quiero de ti

Después de procesar este documento:

1. inspecciona el repositorio;
2. si está vacío, inicializa el proyecto;
3. utiliza las versiones estables actuales y compatibles;
4. configura Astro + React + TypeScript;
5. configura Tailwind correctamente;
6. configura shadcn;
7. configura estructura base;
8. configura lint/format/typecheck;
9. configura Vitest;
10. configura Playwright;
11. crea documentación arquitectónica inicial;
12. crea `AGENTS.md`;
13. crea estructura `knowledge/`;
14. crea registro inicial de fuentes;
15. diseña el modelo de datos inicial;
16. prepara Supabase;
17. crea `.env.example`;
18. prepara migraciones iniciales únicamente necesarias;
19. crea un layout visual inicial de calidad;
20. crea navegación base;
21. crea al menos la estructura funcional de Home / Pokémon / Wiki / Rotaciones / Herramientas;
22. no llenes la web de datos inventados;
23. crea fixtures aisladas si son necesarias para desarrollar UI;
24. ejecuta lint;
25. ejecuta typecheck;
26. ejecuta tests;
27. ejecuta build;
28. corrige los problemas encontrados;
29. verifica visualmente la aplicación;
30. si Vercel está disponible y autorizado, crea un Preview Deployment;
31. comprueba que el deployment funciona;
32. documenta exactamente qué quedó terminado y qué corresponde a la siguiente fase.

# 70. Cómo debes trabajar

No tomes decisiones importantes arbitrariamente.

Cuando exista una decisión arquitectónica relevante:

* piensa;
* compara alternativas;
* elige la más simple que cumpla los requisitos;
* documenta la razón.

Pero no me detengas constantemente para preguntarme detalles pequeños.

Si algo puede decidirse razonablemente con buenas prácticas, hazlo.

Pregunta sólo cuando la decisión dependa realmente de una preferencia de producto imposible de inferir.

No dejes código a medias sólo porque una funcionalidad futura todavía no existe.

Construye una base sólida.

# 71. Regla final

Este proyecto debe optimizarse para cuatro cosas:

**calidad de información, mantenibilidad, velocidad y capacidad de crecer.**

No optimices para terminar una captura bonita hoy y rehacer todo dentro de dos meses.

Quiero que cada decisión tenga sentido para una plataforma real de PokeAlliance que pueda evolucionar desde una wiki comunitaria pequeña hasta una aplicación con miles de usuarios, herramientas avanzadas, perfiles y marketplace.

Empieza por pensar correctamente la arquitectura y después ejecútala.

