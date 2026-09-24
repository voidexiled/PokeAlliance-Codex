# Plan SEO de PokeAlliance Wiki

Fecha: 2026-09-24. Objetivo del propietario: que «PokeAlliance Wiki» (antes Alliance Codex) quede por encima de todas las demás wikis de PokeAlliance y que el trabajo de SEO empiece antes del lanzamiento.

Se basa en tres investigaciones del mismo día: competidores y resultados de búsqueda, demanda e idiomas, y SEO técnico del sitio publicado. Las posiciones salen de un buscador que consulta desde EE. UU. (no Google Brasil), así que son orientativas. No se obtuvieron volúmenes de búsqueda: todo porcentaje de demanda de este documento es una estimación y dice de dónde sale. Los datos en bruto están en el scratchpad de la sesión (`…/scratchpad/comp/` y `…/scratchpad/seo-demand/`).

Quién hace cada cosa: **Propietario** (dominio, Vercel, Search Console, Bing, contacto con Discord y creadores, decisiones y datos del juego) o **Equipo** (código, plantillas, pruebas y redacción editorial).

## 0. Punto de partida

| Hecho observado | Consecuencia |
|---|---|
| Nuestro sitio no aparece en ninguna de las ~25 consultas probadas, ni siquiera para «alliance codex». | Hoy no tenemos tráfico que proteger: se puede cambiar marca, dominio y URL sin coste. |
| 6 de los 8 competidores principales (wiki oficial, pkaguide, pkahelper, pka-wiki, wiki-pka, wiki ES) entregan HTML vacío o una sola URL con pestañas. Solo pkatools.com.br y pokealliance-wiki.vercel.app (Lukkezin) sirven HTML completo, y solo pkatools usa JSON-LD. | Nuestras páginas estáticas con título, descripción, canonical y hreflang propios ya superan a casi todos en lo básico. |
| Ninguna página de PokeAlliance posiciona para «pokealliance charizard / gengar» (ganan pokemon.com, Bulbapedia, Serebii), ni para mercado, precios o mapa. | Huecos sin competencia: fichas de Pokémon, ítems/Market y mapa. |
| «pokealliance tier list» y «pokealliance held items» los gana wiki.pokexgames.com, de otro servidor. | Las páginas de PokeAlliance sobre esos temas son débiles o no están indexadas. |
| Un repositorio borrado (GitHub SkymerLight, 404) sigue en 1.º–2.º puesto para rotações, melhores pokemon, guía español y mapa. | Hay tráfico de equipos y rotaciones de Hoenn 350+ que nadie sirve. |
| Demanda por idioma (estimación: Google Trends × usuarios de internet por país): pt ≈ 85 %, es ≈ 15 %, en < 1 %. Brasil 100 y Venezuela 67 en interés a 30 días; ~90 % de las vistas de YouTube observadas son de vídeos en portugués; la descripción del Discord oficial (29.128 miembros) está en portugués. | Sin pt-BR competimos solo por una fracción pequeña de las búsquedas. |
| «wiki poke alliance» es la consulta relacionada principal y sube +250 %; el interés por PokeAlliance llegó a 100 la semana del 13 al 19/09 (lanzamiento de Titan el 21/08), mientras PokeXGames bajó a 22–33. | La demanda está creciendo ahora; conviene estar indexados antes del lanzamiento. |
| Nuestro sitio: ~898 de las 910 fichas por idioma no reciben ningún enlace interno; 42 de 75 ítems son borradores publicados («Item de ejemplo 1/2» en `/es/items/`); los títulos no contienen «PokeAlliance»; `content/pokemon.json` solo tiene 10 campos (sin drops, evolución, ubicación ni movimientos); `content/cambios.json` tiene 0 entradas. | Son los problemas propios que más frenan: rastreo, contenido delgado y relevancia del título. |

## 1. Marca sin parecer oficial

- **Por qué «PokeAlliance Wiki» ayuda:** coincide con la consulta que más crece («wiki poke alliance») y mete «PokeAlliance» en cada título a través del sufijo de marca.
- **Colisiones:** pokealliance-wiki.vercel.app (Lukkezin) ya usa exactamente el título «PokeAlliance Wiki», y con espacio («poke alliance wiki») gana pokemon-alliance.fandom.com, un juego distinto (Warcraft x Pokémon, sin lanzar). Nos diferencian el dominio propio, un logo propio y el `name` del JSON-LD `WebSite` (§8), que es lo que Google usa para mostrar el nombre del sitio.
- **Reglas (Equipo, en código y textos):**
  - Nunca «oficial», ni en metadatos (pka-wiki.pages.dev se describe como «Wiki oficial do servidor PokeAlliance» y pone `author` «PokeAlliance»: no lo copiamos). Sin `author` ni `publisher` que nombren al juego.
  - Sin logos de PokeAlliance ni de Pokémon: logo, favicon y `og:image` propios.
  - Línea de no afiliación en el pie de todas las páginas y en una página «Acerca de» (A10):
    - pt: «PokeAlliance Wiki é um projeto independente da comunidade, sem afiliação com o PokeAlliance.»
    - es: «PokeAlliance Wiki es un proyecto independiente de la comunidad, no afiliado a PokeAlliance.»
    - en: «PokeAlliance Wiki is an independent community project, not affiliated with PokeAlliance.»
  - En los títulos, la marca va siempre al final (« | PokeAlliance Wiki»), después de la palabra clave; si Google corta el título, se pierde la marca y no la entidad.

## 2. Dominio

**Estado (comprobado el 2026-09-24 18:29 UTC):** `pokealliancewiki.com` se registró hoy a las 18:17 UTC (RDAP de Verisign, registrador Cloudflare, DNS en Cloudflare) y ya sirve el proyecto de Vercel. Pero hoy hay tres hosts con el mismo HTML: `pokealliancewiki.com` y `www.pokealliancewiki.com` responden 302 → `/es/` y `pokealliance-codex.vercel.app` responde 200. En los tres, la canonical, el hreflang, el sitemap y `robots.txt` apuntan todavía a `pokealliance-codex.vercel.app`.

**Por qué cerrar el dominio antes del lanzamiento:**
1. Todos los enlaces del lanzamiento (Discord, descripciones de YouTube, perfiles) se quedan en la URL final; cambiarla después obliga a una migración con 308 y pierde parte de la señal.
2. La propiedad de tipo **Dominio** de Search Console se verifica por DNS, y eso solo es posible con un dominio propio.
3. Resend lo necesita para el correo de las cuentas (`docs/LANZAMIENTO.md`).
4. Un dominio con la marca y la palabra clave se reconoce y se pulsa mejor. Como factor de ranking directo pesa poco: el efecto viene del reconocimiento y de los enlaces con ese texto.

**Qué hacer:**
- **Propietario, en Vercel → Settings → Domains:** `pokealliancewiki.com` como dominio principal; `www.pokealliancewiki.com` con «Redirect to» `pokealliancewiki.com` (308); `pokealliance-codex.vercel.app` con redirección 308 al dominio. Si el panel no permite redirigir el dominio `vercel.app`, el Equipo añade una redirección condicionada al host `pokealliance-codex.vercel.app` (solo ese host, para no romper las vistas previas).
- **Equipo:** un único origen para `SITE`, que hoy está escrito a mano en tres lugares: `astro.config.mjs:24`, `scripts/seo/check-dist.mjs:50` y `public/robots.txt`. `robots.txt` pasa a generarse desde un endpoint `src/pages/robots.txt.ts`.
- **Comprobación:** `curl -I` de los tres hosts → 308 al apex, y canonical, hreflang, `og:url` y sitemap con `https://pokealliancewiki.com`.

**Otros nombres (disponibilidad RDAP a 2026-09-24, solo como alternativas o registro defensivo; no aportan ranking):** libres `pokealliance.wiki`, `pokealliance-wiki.com`, `pkawiki.com`, `wikipka.com`, `pkadex.com`, `pokealliancedex.com`, `pokealliance.gg`; ocupado `pka.wiki` (desde 2019). Un `.com.br` exige CPF o CNPJ y orienta el sitio a Brasil, lo que perjudica a `es`: mejor no.

**Riesgo:** el dominio contiene la marca del juego. Si el staff de PokeAlliance se opusiera, podría reclamarlo. Lo mitigan la línea de no afiliación y hablar con el staff antes del lanzamiento (§5, punto 3), lo que además puede traer un enlace.

## 3. Idiomas: añadir pt-BR y hacerlo el predeterminado

**Evidencia:** sitio y wiki oficiales solo en pt-BR; las 20 noticias del launcher en pt-BR; Discord oficial en portugués; ~90 % de las vistas de YouTube en portugués; Trends: Brasil 100, Venezuela 67, Chile 34. En español hay un solo competidor (wiki-pokealliance-es.pages.dev, con `<title>` vacío y las mismas URL para es y pt); en inglés, prácticamente nada que medir.

**Decisión propuesta (Propietario decide; Equipo implementa):**
- Tercer idioma `pt` en `/pt/…`, con `hreflang="pt-BR"`, `<html lang="pt-BR">` y `og:locale` `pt_BR`.
- `x-default` → `/pt/` y `/` → 302 a `/pt/`. Sin detección por `Accept-Language` (Googlebot rastrea sin ella).
- `es` se queda con `hreflang="es"` para todo el público hispano. `es-419` no vale: Google solo acepta regiones ISO 3166-1 en hreflang. `en` se mantiene sin trabajo editorial extra.
- Las carpetas no se traducen (`/pt/sistemas/`, `/pt/pokedex/`). Que `/en/` use carpetas en español es una señal débil, y cambiarlo cuesta rutas, redirecciones y pruebas.
- Qué se traduce, siguiendo las reglas de localización de `AGENTS.md`:
  - el diccionario de interfaz, en un nuevo `src/i18n/messages/pt.ts`;
  - los textos editoriales de `content/` (sistemas, actividades), añadiendo `pt` a sus esquemas JSON y a los espejos Zod a la vez;
  - los nombres de elementos en `content/elementos.json`, pero solo después de comprobar qué términos usa PokeAlliance en portugués (regla 5).
  - Los nombres canónicos no se traducen: siguen en inglés, igual que hace el propio juego, que en su changelog del 19/08 dejó a propósito en inglés los movimientos, los ítems y los tiers.
- **Calidad:** un revisor nativo de portugués (el Propietario lo busca en el Discord) revisa las páginas centrales antes de publicarlas. Una traducción automática sin revisar se nota, y el público principal es brasileño.
- **Efecto esperado:** abre la parte de la demanda estimada en ≈85 %. Con 910 variantes por idioma serán 2.730 fichas y unas 2.800 URL en el sitemap.
- **Documentación:** cambia §13.1, §13.5 y §15 de `docs/CORTE_0_CODEX_TOOLTIP_SPEC.md` y se registra como D-029 en `docs/DECISION_LOG.md`.

## 4. Antes del lanzamiento (en este orden)

### A1. Dominio canónico único — Propietario + Equipo
- **Por qué:** hoy hay tres hosts duplicados y la canonical apunta al que vamos a abandonar (§2).
- **Qué:** lo descrito en §2.
- **Efecto:** toda la señal (enlaces, indexación, Search Console) se concentra en `pokealliancewiki.com` desde el primer día.

### A2. Search Console y Bing Webmaster Tools — Propietario
- **Por qué:** indexar lleva semanas, y el Propietario quiere empezar antes del lanzamiento.
- **Qué:**
  - **Search Console:** propiedad de tipo Dominio con registro TXT en Cloudflare y envío de `https://pokealliancewiki.com/sitemap-index.xml` en cuanto A1 esté desplegado.
  - **Bing Webmaster Tools:** «Importar desde Google Search Console».
  - **Opcional:** IndexNow para Bing, que avisa de cada despliegue. Google no lo usa.
- **Efecto:** empieza el rastreo, y tenemos datos de indexación y de consultas desde Brasil, México y Venezuela, que nuestra investigación no pudo obtener.

### A3. Enlazar las 910 fichas — Equipo
- **Por qué:**
  - `/es/pokedex/` prerenderiza 12 tarjetas, y `?page=2` devuelve el mismo HTML que la primera página.
  - La tier list prerenderiza 32 de 818 entradas, como `<span role="img">`, no como enlaces.
  - Cada ficha solo enlaza a la variante con su mismo número, porque ningún registro tiene `evolucion`.
  - En total, ~898 fichas por idioma solo se descubren por el sitemap.
- **Qué:**
  1. Índice A–Z estático `/{l}/pokedex/todos/` con las 910 fichas como `<a>` simples (≈55 KB sin comprimir).
  2. Páginas de aterrizaje estáticas por elemento (`/{l}/pokedex/elemento/{id}/`, 18) y por generación (`/{l}/pokedex/generacion/{n}/`), con id estable y no traducido. En la ficha, el Tier, los Elementos y la Generación enlazan a esas páginas, igual que los 18 enlaces `?elemento=` del inicio.
  3. Ranuras de la tier list como `<a href="/{l}/pokedex/{id}/">` (`src/components/tiers/TiersRoot.tsx` y el componente de ranura), todas prerenderizadas.
  4. Enlaces anterior/siguiente por número de Pokédex en `src/pages/[locale]/pokedex/[slug].astro`.
  5. Un bloque «mismos elementos y tier» en la ficha, con 6–8 enlaces sacados de los datos.
- **Efecto:** cada ficha recibe al menos 4 enlaces internos. Es la condición para que Google las rastree a menudo y las considere importantes, y la base para ganar «pokealliance [pokémon]», consulta que hoy no gana ninguna web de PokeAlliance.

### A4. Sacar del índice los borradores — Propietario + Equipo
- **Por qué:** 11 de las 13 categorías de ítems solo tienen registros `borrador` (42 de 75 ítems), y son 22 URL delgadas en el sitemap. `/es/items/` muestra «Item de ejemplo 1/2».
- **Qué:**
  - **Propietario:** `OCULTAR_BORRADORES=1` en el entorno Production de Vercel.
  - **Equipo:** en `getStaticPaths` de `src/pages/[locale]/items/c/[categoria].astro` se omiten las categorías sin ítems publicados. La categoría vuelve sola cuando el Propietario rellene su registro.
- **Efecto:** el sitio deja de mostrar a Google páginas de relleno, que restan calidad al conjunto.

### A5. Títulos, descripciones y H1 con la marca y el juego — Equipo
- **Por qué:** hoy los títulos son «Charizard · Pokédex · Alliance Codex» y «Tier list · Alliance Codex», sin «PokeAlliance». pkatools, el competidor mejor posicionado, pone el juego y la entidad en cada título.
- **Qué:**
  - Aplicar las plantillas de §7 y cambiar el H1 del inicio a «Wiki do PokeAlliance» / «Wiki de PokeAlliance» / «PokeAlliance wiki».
  - Actualizar `MARCA`, `SUFIJO_TITULO` y `TITULO_INICIO` en `scripts/seo/check-dist.mjs` y la tabla de §13.5.
  - En las descripciones de sistema demasiado cortas (la de `/es/sistemas/boost/` tiene 60 caracteres), añadir «en PokeAlliance».
- **Efecto:** relevancia directa para «[entidad] poke alliance» y un mejor CTR en las consultas de marca.

### A6. pt-BR — Equipo + revisor nativo
- Descrito en §3. Va antes del lanzamiento porque el anuncio llega a un público brasileño (Discord y YouTube en portugués). Si no llega a tiempo, se lanza en `es`/`en` y pt-BR es lo primero de §6.

### A7. Fichas con datos que la competencia no tiene — Propietario (datos) + Equipo (plantilla)
- **Por qué:**
  - La ficha de Charizard tiene ~226 palabras, de las que ~60 son propias.
  - Con 1.820 fichas casi iguales (2.730 con pt), Google puede dejar muchas en «rastreada, sin indexar».
  - La API de la wiki oficial ya da, por Pokémon, HP, XP, movimientos (slot, nombre, cooldown) y habilidades; pkaguide y pkahelper anuncian drops, localizações y tasks.
  - Ninguna página de Pokémon de la competencia se ve en HTML con drops, evolución y dónde cazar a la vez.
- **Qué:**
  - Rellenar en `content/pokemon.json` los campos `evolucion` (con ítems), drops, dónde cazar y movimientos. Lo desconocido va como `null`, y no se añade ninguna fuente ni procedencia (D-012).
  - Orden: primero los Pokémon con demanda observada (ditto, blastoise, heracross, marowak, rhyhorn, steelix, umbreon, sacados del autocompletado) y los de los títulos de YouTube; después, por tier.
  - Material de partida del Propietario: su investigación del cliente (autorizada, solo lectura) y la hoja comunitaria de `research-inbox/community-files/` (pestañas Drops, Localizações y Tasks). Decide él qué se usa.
  - La ficha shiny compara con la normal usando datos reales (Shiny Charizard: T1, nivel 120; Charizard: T3, nivel 80) para que no sea un duplicado.
- **Efecto:** es lo que convierte una ficha indexable en una que gana. Es también el requisito de las páginas de ítem de D1 («quem dropa»).

### A8. Metadatos para compartir y datos estructurados básicos — Equipo
- **Por qué:**
  - `src/layouts/PageLayout.astro` no tiene `<link rel="icon">`, aunque `public/favicon.svg` y `favicon.ico` existen; sin ese enlace, Google no muestra el favicon.
  - Sin `og:image`, los enlaces compartidos en Discord salen sin imagen.
  - Solo pkatools usa JSON-LD.
- **Qué:**
  - `rel="icon"` (SVG e ICO) y `apple-touch-icon`.
  - Un `og:image` de 1200×630 con arte propio para todo el sitio y `twitter:card` `summary_large_image`.
  - JSON-LD `WebSite` (con `about` `VideoGame`) en el inicio y `BreadcrumbList` en todas las páginas con migas (§8).
  - Quitar la regla de `scripts/seo/check-dist.mjs` que hace fallar el build con `og:image` o JSON-LD y sustituirla por una que los valide. Sacar `BreadcrumbList` y `WebSite` de la condición de arte de §15, porque no usan arte de Pokémon.
- **Efecto:** favicon y nombre del sitio en los resultados, migas en lugar de la URL y vistas previas atractivas en Discord, donde se comparten los enlaces de esta comunidad.

### A9. Sitemap, canonical y noindex — Equipo
- **Sitemap:**
  - `lastmod` real a través de `serialize` (solo si es exacto; si no, mejor omitirlo) y alternates con `x-default`.
  - Comercio: `/{l}/comercio/` es indexable pero no está en el sitemap, porque se renderiza bajo demanda. Se añade con `customPages` cuando `COMERCIO_PUBLICO` esté activo, o se marca `noindex` mientras solo muestre la puerta de +18.
  - Una regla nueva en `check-dist.mjs`: toda página indexable está en el sitemap.
- **noindex:** `/{l}/buscar/` (hoy está en el sitemap), añadiéndolo a `NOINDEX_ROUTES` en `astro.config.mjs` y pasando `noindex` en `src/pages/[locale]/buscar/index.astro`.
- **Canonical y 404:**
  - La ruta sin barra final (`/es/pokedex/charizard`) responde 200: debe hacer 308 a la versión con barra.
  - La 404 no debe llevar canonical ni hreflang.
- **Efecto:** Google rastrea exactamente las URL que queremos y ninguna más.

### A10. «Acerca de» y contacto — Propietario (texto) + Equipo
- **Qué:** la página `/{l}/acerca/` explica quién mantiene el sitio, cómo contactar, la no afiliación y cómo se corrigen errores. No lleva fuentes (D-012).
- **Efecto:** señal de confianza para buscadores y jugadores, y respaldo ante cualquier queja sobre la marca.

### A11. Velocidad — Equipo
- **Por qué:**
  - El sitio ya es ligero: HTML de 12–17 KB comprimido y ~81–91 KB de JS inicial.
  - Los assets con hash de `/_astro/` salen con `max-age=0`, porque en `.vercel/output/config.json` la regla de caché inmutable va después de `{"handle":"filesystem"}`.
  - La imagen principal de la ficha tiene `alt=""`, se enlaza en caliente desde `wiki.pokealliance.com` y la prueba de rendimiento de §13.6 no la mide.
- **Qué:**
  - En el hook `astro:build:done` de `redirects302()` (`astro.config.mjs`), mover esa regla de caché antes de la de filesystem y comprobarlo con `curl -I`.
  - En la imagen principal: `alt={nombre}`, `fetchpriority="high"` y `preconnect` al origen de la imagen.
- **Efecto:** mejor LCP en las visitas repetidas y un texto alternativo útil para Google Imágenes. La dependencia de la wiki oficial se trata en §10.

### A12. Cambios con contenido — Propietario
- **Por qué:** `content/cambios.json` tiene 0 entradas, mientras los competidores se actualizan a diario o cada semana (wiki oficial 19/09, pkaguide 20/09, wiki ES y sitemap de pkatools 24/09) y pkatools tiene una sección «novidades» con los changelogs del launcher.
- **Qué:** cargar las 20 noticias del launcher (`research-inbox/client-files/roaming/PokeAlliance/cache/feed.json`) y añadir cada parche nuevo en menos de 48 h.
- **Efecto:** una señal de frescura que se puede rastrear, y una página que posiciona por «novidades/changelog poke alliance».

## 5. Día del lanzamiento

1. **Despliegue y verificación (Equipo):** desplegar el árbol actual. Lo publicado es un despliegue anterior: por ejemplo, `/es/pokedex/tiers/` todavía muestra la fila ULTIMATE que el código ya oculta. Después, comprobar:
   - que los tres hosts responden 308 al dominio;
   - que las canonicals usan el dominio;
   - que el sitemap no tiene `/buscar/` ni categorías vacías;
   - que no aparece «Item de ejemplo»;
   - que el favicon y el `og:image` aparecen al pegar un enlace en Discord.
2. **Buscadores (Propietario):**
   - En Search Console, reenviar el sitemap y pedir la indexación, con «Inspección de URLs», de los hubs de cada idioma: inicio, Pokédex, índice A–Z, tier list, ítems, sistemas y cambios.
   - En Bing, enviar el sitemap o hacer ping a IndexNow.
3. **Discord oficial (Propietario):** pedir al staff permiso para anunciarlo en el canal adecuado. No hacer spam en canales generales: es su comunidad (29.128 miembros). Proponer al staff que enlacen la wiki. Hoy pokealliance.com no enlaza ni a su propia wiki oficial, así que la probabilidad es baja, pero el coste es nulo.
4. **Creadores de YouTube (Propietario):** mandar a cada uno la página que corresponde a su vídeo y pedirle el enlace en la descripción. Los vídeos ocupan 1–3 de las primeras posiciones en «guia», «wiki», «talentos» y «melhores pokemon».

   | Creador | Vídeo | Página que le corresponde |
   |---|---|---|
   | Canal Do Loxas | «Treino e Boost» / «TUDO SOBRE TREINO, BOOST…» | `/pt/sistemas/boost/` |
   | Ramidlav | «QUAL ELEMENTO FOCAR» | páginas de elemento (A3) |
   | Empregolista | «Dungeons Seladas» | página de dungeons (cuando exista) |
   | AlastraSz | «Sistemas únicos» | `/pt/sistemas/` |
   | KINGSHOP GAMING, Angelito (es) | guías de nivel | `/es/` |

   A cambio, se ofrece incrustar su vídeo en la página relacionada.
5. **Vigilancia (Equipo):** las primeras 48 h, revisar los 404 y los errores en los logs de Vercel, y en Search Console el informe de páginas y los errores de datos estructurados.

## 6. Después del lanzamiento (0–3 meses, por prioridad)

- **D1. Páginas de ítem `/{l}/items/{id}/` con «quem dropa» y usos (Propietario datos, Equipo plantilla).** Nadie posiciona para mercado, precios ni «[ítem] drop». Requiere los drops de A7 y la decisión del Propietario (§15 las deja fuera).
- **D2. Mapa real (Propietario decide: decisión A11 de la especificación del Corte 0).** Ningún sitio de mapa aparece para «pokealliance mapa», y «mapa completo» es una sugerencia fuerte del autocompletado. Hoy `/mapa/` es un marcador de posición `noindex`.
- **D3. Guías editoriales en `/{l}/guias/` (hoy redirige, E2).** Por orden:
  - «Times por elemento para Hoenn 350+», el tráfico que dejó el repositorio SkymerLight;
  - «Como upar do 1 ao 150»;
  - «O que fazer depois do 150»;
  - en español, «Cómo ganar dinero en Poke Alliance», porque el público hispano habla de dinero (vídeos «GANAR DINERO REAL», «vender tus kks»).

  Cada guía incrusta el vídeo del creador correspondiente.
- **D4. Herramientas con URL propia:**
  - calculadora de Boost (el repositorio de ZAHAL llegó al 1.º puesto en 4 días);
  - coste de build (training, STAR y Boost);
  - calculadora de kk;
  - tasa de captura, porque «critical catch poke alliance» está marcado como Breakout en Trends y «média de balls» aparece en el autocompletado.

  Hoy cada una vive en un sitio suelto; dentro del nuestro suman señal.
- **D5. Comercio:** hubs indexables por categoría del Market cuando haya anuncios reales, en español con el vocabulario «vender kks / precios». El detalle de anuncio y el perfil de vendedor siguen `noindex` (§9.3).
- **D6. Datos estructurados, segunda fase (§8):** `Dataset` en la Pokédex y `VideoObject` en las guías con vídeo.
- **D7. Enlaces entrantes:**
  - pedir enlace a los sitios de herramientas, que no compiten en datos del juego (pkatools es de estadísticas);
  - volver a intentarlo con el staff;
  - responder con enlaces concretos en el Discord cuando alguien pregunte.

  Sin compra de enlaces ni directorios.
- **D8. Mantenimiento:** Cambios dentro de las 48 h de cada parche y la tier list revisada con cada cambio de balance. Mostrar una fecha de «actualizado» visible en la página requiere antes confirmar con el Propietario que no choca con D-012; `lastmod` en el sitemap y las entradas de Cambios no chocan.
- **D9. Revisión mensual de la competencia:** repetir las ~25 consultas del informe de competidores y comprobar si la wiki oficial pasa a renderizar en el servidor. Si lo hace, su API de 910 entradas la vuelve fuerte, y nuestra ventaja tiene que ser la profundidad de datos, los idiomas y la velocidad.

## 7. Plantillas de título y descripción

**Reglas:**
- Primero la entidad, después «Poke Alliance» y al final « | PokeAlliance Wiki». En Trends a 90 días, «poke alliance» (con espacio) promedia 24 y «pokealliance», 17; la marca aporta la forma junta, así que el título lleva las dos grafías.
- Objetivo: 65 caracteres o menos. Si pasa de 70, se quita primero el nivel y después el tier.
- Cada dato ausente (`null`) se omite con su separador. Nunca se escribe una cifra que no salga de los datos.
- Descripción de 70 a 160 caracteres. Menciona «PKA» una vez; «Pokémon Alliance» solo en la del inicio, porque choca con el Fandom ajeno y con el set de TCG.

**Títulos:**

| Página | pt-BR | es | en |
|---|---|---|---|
| Inicio | PokeAlliance Wiki: Pokédex, tier list e sistemas do Poke Alliance | PokeAlliance Wiki: Pokédex, tier list y sistemas de Poke Alliance | PokeAlliance Wiki: Pokédex, tier list and systems for Poke Alliance |
| Pokédex | Pokédex do Poke Alliance (PKA) \| PokeAlliance Wiki | Pokédex de Poke Alliance (PKA) \| PokeAlliance Wiki | Poke Alliance (PKA) Pokédex \| PokeAlliance Wiki |
| Ficha | {nome} no Poke Alliance: tier {tier}, nível {nível} \| PokeAlliance Wiki | {nombre} en Poke Alliance: tier {tier}, nivel {nivel} \| PokeAlliance Wiki | {name} in Poke Alliance: tier {tier}, level {level} \| PokeAlliance Wiki |
| Elemento | Pokémon de {elemento} no Poke Alliance \| PokeAlliance Wiki | Pokémon de {elemento} en Poke Alliance \| PokeAlliance Wiki | {element} Pokémon in Poke Alliance \| PokeAlliance Wiki |
| Índice A–Z | Todos os Pokémon do Poke Alliance de A a Z \| PokeAlliance Wiki | Todos los Pokémon de Poke Alliance de la A a la Z \| PokeAlliance Wiki | All Poke Alliance Pokémon A–Z \| PokeAlliance Wiki |
| Tier list | Tier List do Poke Alliance (PKA) \| PokeAlliance Wiki | Tier list de Poke Alliance (PKA) \| PokeAlliance Wiki | Poke Alliance (PKA) tier list \| PokeAlliance Wiki |
| Ítems | Itens do Poke Alliance por categoria do Market \| PokeAlliance Wiki | Ítems de Poke Alliance por categoría del Market \| PokeAlliance Wiki | Poke Alliance items by Market category \| PokeAlliance Wiki |
| Categoría | {categoria} no Poke Alliance: itens do Market \| PokeAlliance Wiki | {categoría} en Poke Alliance: ítems del Market \| PokeAlliance Wiki | {category} in Poke Alliance: Market items \| PokeAlliance Wiki |
| Sistema | {sistema} no Poke Alliance: como funciona \| PokeAlliance Wiki | {sistema} en Poke Alliance: cómo funciona \| PokeAlliance Wiki | {system} in Poke Alliance: how it works \| PokeAlliance Wiki |
| Cambios | Novidades e changelog do Poke Alliance \| PokeAlliance Wiki | Novedades y cambios de Poke Alliance \| PokeAlliance Wiki | Poke Alliance changelog \| PokeAlliance Wiki |
| Comercio | Comércio do Poke Alliance: anúncios entre jogadores \| PokeAlliance Wiki | Comercio de Poke Alliance: compra y venta entre jugadores \| PokeAlliance Wiki | Poke Alliance trade: player listings \| PokeAlliance Wiki |
| Guild | Atividade de guild no Poke Alliance \| PokeAlliance Wiki | Actividad de guild en Poke Alliance \| PokeAlliance Wiki | Poke Alliance guild activity \| PokeAlliance Wiki |
| Ítem (D1) | {item} no Poke Alliance: quem dropa e uso \| PokeAlliance Wiki | {ítem} en Poke Alliance: quién lo suelta y uso \| PokeAlliance Wiki | {item} in Poke Alliance: drops and uses \| PokeAlliance Wiki |
| Mapa (D2) | Mapa completo do Poke Alliance \| PokeAlliance Wiki | Mapa completo de Poke Alliance \| PokeAlliance Wiki | Poke Alliance full map \| PokeAlliance Wiki |

Ejemplos con datos reales:
- «Charizard no Poke Alliance: tier T3, nível 80 | PokeAlliance Wiki» (65 caracteres).
- «Shiny Charizard no Poke Alliance: tier T1 | PokeAlliance Wiki» (61; con el nivel medía 72).
- Sistema: «Boost no Poke Alliance: como funciona | PokeAlliance Wiki» (57).

**Descripciones (entre llaves, datos del registro; las partes sin dato se omiten):**

| Página | pt-BR | es | en |
|---|---|---|---|
| Inicio | Wiki da comunidade do Poke Alliance (PKA, Pokémon Alliance): Pokédex com {n} variantes, tier list, itens do Market, sistemas e comércio entre jogadores. | Wiki de la comunidad de Poke Alliance (PKA, Pokémon Alliance): Pokédex con {n} variantes, tier list, ítems del Market, sistemas y comercio entre jugadores. | Poke Alliance (PKA, Pokémon Alliance) community wiki: Pokédex with {n} variants, tier list, Market items, systems and player trade. |
| Ficha | {nome} no PokeAlliance (PKA): {elementos}, nível {nível}, tier {tier}, função {função}.{ Evolui com {itens}.}{ Dropa {drops}.}{ Onde caçar: {local}.} | {nombre} en PokeAlliance (PKA): {elementos}, nivel {nivel}, tier {tier}, rol {rol}.{ Evoluciona con {ítems}.}{ Suelta {drops}.}{ Dónde cazarlo: {lugar}.} | {name} in PokeAlliance (PKA): {elements}, level {level}, tier {tier}, role {role}.{ Evolves with {items}.}{ Drops {drops}.}{ Where to hunt: {place}.} |
| Tier list | Tier list de todos os Pokémon do Poke Alliance (PKA), do T1 ao T7, com nível e elementos. | Tier list de todos los Pokémon de Poke Alliance (PKA), de T1 a T7, con nivel y elementos. | Tier list of every Poke Alliance (PKA) Pokémon, T1 to T7, with level and elements. |
| Sistema | Primeira frase do texto do sistema, cortada abaixo de 160, terminando com «no PokeAlliance» se faltar. | Igual, con «en PokeAlliance». | Same, with «in PokeAlliance». |
| Categoría | {categoria} do Market do Poke Alliance (PKA): {n} itens com preço de NPC e uso. | {categoría} del Market de Poke Alliance (PKA): {n} ítems con precio de NPC y uso. | {category} in the Poke Alliance (PKA) Market: {n} items with NPC price and use. |

Los rangos de tier de la descripción de la tier list salen de `content/tiers.json`; si la tier list muestra otros niveles (Legendary, ULTIMATE…), la plantilla los lee de ahí y no los escribe a mano. El «preço de NPC» de la descripción de categoría solo se escribe si el registro lo tiene.

H1: la ficha mantiene el nombre de la entidad («Charizard»). El inicio cambia a «Wiki do PokeAlliance» / «Wiki de PokeAlliance» / «PokeAlliance wiki».

## 8. Datos estructurados

| Tipo | Dónde | Para qué sirve (con honestidad) | Cuándo |
|---|---|---|---|
| `WebSite` (`name` «PokeAlliance Wiki», `alternateName` «Alliance Codex», `url`, `inLanguage`) | Inicio de cada idioma | Google lo usa para el nombre del sitio en los resultados; es nuestra mejor defensa frente al otro «PokeAlliance Wiki». | A8 |
| `about` → `VideoGame` (`name` «PokeAlliance», `url` `https://pokealliance.com/`) | Dentro de `WebSite` | Solo semántico, sin resultado enriquecido: deja claro a qué juego nos referimos (no es el «Pokemon Alliance» de Fandom). | A8 |
| `BreadcrumbList` | Todas las páginas con migas | Migas en lugar de la URL en el resultado. | A8 |
| `Dataset` (con `distribution` → `/{l}/pokedex/datos.json`) | Pokédex | Aparecer en Google Dataset Search (pkatools lo usa). | D6 |
| `VideoObject` o solo el iframe de YouTube | Guías con vídeo incrustado | Resultados de vídeo. | D3/D6 |
| `ItemList` | Pokédex, elementos, tier list | Solo semántico: Google no da carrusel para este tipo de listas. Baja prioridad. | Opcional |
| `Organization` con logo propio | Inicio | Poco efecto para un proyecto comunitario. | Opcional |

No usar:
- `SearchAction`: Google retiró el cuadro de búsqueda de sitelinks en 2024.
- `FAQPage`: desde 2023 Google solo muestra ese resultado a sitios gubernamentales y de salud.
- `Product`/`Offer` en Comercio: son anuncios entre jugadores, sus páginas son `noindex`, y marcarlos como productos sería engañoso.
- Nada que diga «oficial».

## 9. Medición (sin analítica en la página)

La especificación (§15) excluye la analítica mientras el Propietario no la pida. Search Console y Bing no necesitan ningún script.

- **Indexación:** cada semana, en el informe «Páginas» de Search Console, filtrado por sitemap y por tipo (fichas frente a hubs).
  - Regla de diagnóstico: si a las 6 semanas del despliegue de A1–A4 hay menos del 50 % de fichas indexadas, el problema es el contenido delgado (A7), no el rastreo.
  - Meta: que se indexen todas las fichas que tengan drops y evolución.
- **Posiciones:** el informe de Rendimiento, filtrado por país (Brasil, Venezuela, México, Chile) y por consultas que contengan «alliance» o «pka». Sustituye a las comprobaciones manuales desde otro país.
  - Metas iniciales (son objetivos, no predicciones): top 5 en Brasil para «pokealliance wiki» y «pokealliance tier list»; impresiones para «[pokémon] poke alliance» en al menos 100 fichas distintas.
- **CTR:** en las consultas con más impresiones y un CTR por debajo de la media del sitio, se reescribe el título dentro de la plantilla.
- **Velocidad:** el informe de Core Web Vitals de Search Console, cuando haya tráfico suficiente, más la prueba de §13.6 con la imagen real.
- **Competencia:** la revisión mensual de D9.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Choque de nombre con pokealliance-wiki.vercel.app. | Dominio, logo y `WebSite.name` propios. No copiar su diseño ni sus textos. |
| El staff reclama la marca o el dominio. | Línea de no afiliación, nada de «oficial» ni logos del juego, y contacto previo con el staff (§5, punto 3). |
| Los 909 retratos se enlazan en caliente desde `wiki.pokealliance.com`, un competidor que puede bloquearlos cuando quiera. Además, Google Imágenes atribuye la imagen a su dominio. | Pedir permiso al staff o conseguir arte redistribuible (UK-006). Hasta entonces, la ficha tiene que seguir siendo útil sin imagen. |
| 2.730 fichas casi iguales. | A7 antes de sumar más URL. Ninguna página nueva sin datos propios (A4 aplica lo mismo a los ítems). |
| Portugués de baja calidad. | Revisor nativo antes de publicar los hubs (§3). |
| La wiki oficial arregla su SEO. | Profundidad de datos, pt/es/en y velocidad (D9). |

## 11. Documentos que cambian con este plan

- `docs/CORTE_0_CODEX_TOOLTIP_SPEC.md`:
  - §13.1: el idioma `pt` y la raíz `/pt/`;
  - §13.5: `site`, plantillas, `og:image`, JSON-LD, favicon y noindex de `/buscar/`;
  - §15: sacar pt-BR, `og:image` y el JSON-LD sin arte de la lista de «fuera de alcance».
- `docs/DECISION_LOG.md`: D-029, con la marca «PokeAlliance Wiki», el dominio `pokealliancewiki.com`, pt-BR como idioma predeterminado y los metadatos enriquecidos.
- `scripts/seo/check-dist.mjs`: `SITIO`, `MARCA`, `SUFIJO_TITULO`, `TITULO_INICIO`, la regla de §15 y la regla nueva de sitemap de A9.
- `docs/LANZAMIENTO.md`: `<dominio>` pasa a ser `pokealliancewiki.com`, y el remitente de Resend, «PokeAlliance Wiki».
