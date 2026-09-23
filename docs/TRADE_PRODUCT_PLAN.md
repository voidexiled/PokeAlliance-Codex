# Comercio / Trade: primera etapa

Estado: diseño de producto y borrador local, 2026-09-16; reglas y decisiones actualizadas el 2026-09-18 (ver D-009 y D-010). No es un mercado público ni una pasarela de pago.

> **Actualización 2026-09-18.** La versión `v1789689677` de los términos (publicada el 2026-09-17, fecha visible sin cambio) eliminó el permiso explícito de RMT fuera de los canales oficiales; sigue prohibido anunciar ventas por dinero real en canales oficiales. El propietario decidió mantener el carril de dinero real sin pasarela: contacto desde el sitio y canales de contacto verificables del vendedor (correo, teléfono con código de país, Discord, Twitch y otras plataformas). Una pasarela futura cobrará promoción y funciones del sitio. El párrafo siguiente describe las reglas vigentes al 2026-09-16 y se conserva como historial.

## Decisión de alcance

El propietario pidió comenzar Comercio para facilitar RMT. Las reglas oficiales consultadas el 2026-09-16 permiten RMT fuera de los canales oficiales y prohíben anunciar ventas por dinero real en chat del juego, Discord y foros oficiales. El servidor declara que no garantiza transacciones externas. La fuente vigente consultada fue `https://www.pokealliance.com/terms` (sección 3 y 7, texto fechado 11/06/2026); la portada `https://pokealliance.com/` también presenta RMT como permitido. Esta conclusión es específica de esa versión y se debe revisar antes de publicar anuncios. Alliance Codex no se presenta como canal oficial.

El orden de fases del proyecto coloca el mercado público después de cuentas, reglas y moderación. Esta petición autoriza iniciar la experiencia y sus contratos, pero no justifica activar una base pública de anuncios sin identidad, reportes, políticas, antiabuso y pruebas RLS. Primera entrega: compositor interactivo en `Comunidad / Comercio`, con borrador de sesión, vista previa y copia manual. No persiste, envía ni cobra. El usuario no verá ofertas ficticias.

## Modelo de publicación propuesto

- Una intención (`vender` o `comprar`) y un activo (`diamonds`, `kks`, `pokemon`, `item`). Un anuncio representa un activo principal. Lotes combinados requieren un modelo explícito posterior.
- Cantidades de KKs enteras y positivas en unidades base. El nombre `kk` es sólo representación: 1,000 = 1k; 1,000,000 = 1kk. Nunca guardar `1.5kk` como cantidad canónica ni usar coma/punto del idioma como separador decimal de game money.
- Pokémon: referencia estable al roster, más una instantánea declarada por el vendedor de la criatura concreta. No confundir hechos del catálogo con atributos de una unidad comerciada.
- Campos de Pokémon candidatos: ball, level, boost, star level, nickname, Held slots, addon, aura, next boost chance, training skills y Ditto Memory. Los nombres de addons/auras/helds introducidos libremente son declaraciones del anunciante hasta que exista un catálogo validado. Un valor omitido significa `no informado`, no cero.
- Ditto Memory: la captura proporcionada por el propietario documenta un caso con seis slots; el propietario especifica un slot por defecto y máximo seis. La primera UI limita el campo a 1–6 y muestra las asignaciones sólo al elegir Ditto/Shiny Ditto. Falta corroboración externa del mecanismo antes de publicarlo como norma de wiki.
- Item: nombre declarado y cantidad entera. Vinculación a un ID canónico sólo cuando exista el catálogo. `NPC price` no debe mezclarse con precio entre jugadores; puede ser desconocido o `unsellable`. No se inventan importes.
- Precio pedido: valor y divisa separados, o negociable. Fiat e ingame money son distintos; sin conversión implícita, cotización oficial ni garantía de valor.
- Futuro anuncio público: vendedor, estado (`draft`, `pending_review`, `published`, `reserved`, `completed`, `expired`, `removed`), marcas temporales, versión de reglas, visibilidad, reporte y auditoría. Ningún contacto privado o dato de pago debe ser público por defecto.

## Flujo y diseño

Una mesa de comercio dentro del shell actual, no un escaparate promocional: categorías reconocibles, edición a la izquierda y anuncio compuesto a la derecha en escritorio; en móvil, edición primero y vista previa después. La dirección visual sigue las capturas del propietario: superficies carbón, acentos amarillos funcionales y valores claros, sin paleta azul/púrpura por categoría. Priorizar imágenes/sprites del objeto sobre pictogramas lineales en selector, campos contextuales y vista previa. Los sprites originales de Diamonds, KKs, Ball e item creados para esta UI son representaciones editoriales, **no** sprites oficiales ni prueba de apariencia canónica; reemplazarlos por assets de juego sólo al verificar uso y licencia. La ficha Pokémon recuerda la lectura compacta del cliente, pero usa componentes web accesibles y no copia píxeles ni assets protegidos. La complejidad se revela sólo para Pokémon y Ditto. Estados de vacío, inválido y copia fallida son explícitos. Animación breve sólo como respuesta de selección/vista previa, respetando movimiento reducido.

### Auditoría de sprites del cliente, 2026-09-17

En `C:\Users\jalom\AppData\Local\PokeAlliance Games\PokeAlliance` existen rutas nominales para `data/images/modules/store_ui/diamond_icon.png`, `data/images/game/slots/coins.png`, `data/images/ui/pokemon_window/pokeball0.png`, `data/images/game/pokemon/pokeball0.png` y `data/images/game/npcicons/item.png`. Sus firmas comienzan con `PKA1`, no PNG; lo mismo ocurre con `data/things/things.dat`, `things.otml` y `things.spr.part1`. Son assets protegidos/no estándar. No copiarlos a `public/`, no intentar descifrarlos ni fingir que los SVG editoriales son sprites del juego.

Las imágenes del compositor salen del registro de sprites (`public/sprites/sprites.json`, D-011): la hoja real del Diamond, la Alliance Ball del juego para el campo Ball y el icono de la página, y la hoja de cualquier item del Market cuando el nombre escrito coincide exactamente (en las hojas de cantidad, el frame sigue a la cantidad). KKs y el item genérico usan arte de relleno (`ui/comercio/kks`, `ui/comercio/item`, con `borrador`) hasta que el propietario vuelque los sprites reales. La categoría Pokémon muestra el retrato de Ditto de `content/pokemon.json`. Publicar un paquete de sprites del cliente sigue sujeto a la autorización de uso web (UK-006).

## Brainstorm y siguientes cortes

1. Catálogo de items con identidad, sprite permitido, categoría, stack, NPC comprador/vendedor, moneda, precio, condición y fecha de verificación. Distinguir `no vende`, `no compra` y `precio desconocido`.
2. Addons como relación muchos-a-muchos con Pokémon/variante específica, restricciones, apariencia y método de obtención. Nunca inferir compatibilidad por especie base.
3. Auras como entidades separadas, con efecto visual, compatibilidad, restricciones y forma de obtenerlas. No confundir aura de una unidad con posibilidad teórica del Pokémon.
4. Helds y Balls con catálogo canónico, slot/tier/estado y disponibilidad. La foto del cliente puede respaldar el anuncio, pero exige revisión de datos personales y derechos antes de subirla.
5. Formulario público con perfil de vendedor, caducidad corta, actualización de disponibilidad, deduplicación, reportes, límites por cuenta, moderación y señales de confianza basadas en hechos observables, no una falsa garantía de seguridad.
6. Contacto externo configurable sólo tras política de privacidad y moderación. No pagos, escrow, verificación de identidad ni intermediación monetaria en la primera fase.
7. Antes de lanzar RMT público: reverificar reglas, revisar protección de menores y obligaciones aplicables, definir términos comunitarios, probar RLS y flujos de abuso, y obtener aceptación del propietario.

## Cuentas, verificación y reseñas (petición añadida el 2026-09-16)

El propietario requiere que compradores y vendedores creen cuenta y verifiquen correo y celular. Esto es un requisito para publicar, iniciar una compra y dejar una reseña, no sólo una insignia visual. Debe existir un flujo general de cuenta reutilizable por Guild y Comercio, con sesión, recuperación de acceso, cambio de correo/teléfono y estados parciales claros. El teléfono nunca se muestra públicamente. La verificación de contacto no equivale a verificación de identidad ni garantía de operación segura.

La implementación propuesta usa Auth existente para correo confirmado y teléfono confirmado mediante OTP. Se deben habilitar y probar en el proyecto real tanto confirmación de correo como proveedor SMS/WhatsApp, con cuotas, CAPTCHA y límites de reenvío. La configuración local actual tiene confirmaciones de correo desactivadas y SMS desactivado; por tanto, **no se debe afirmar que este requisito ya funciona**. La comprobación para publicar/reseñar debe imponerse en base de datos/servidor, no sólo esconder botones. Supabase documenta `updateUser({ phone })` y `verifyOtp({ type: 'phone_change' })` para añadir un teléfono a una cuenta existente; MFA de teléfono es un mecanismo adicional distinto, que se decidirá al implementar el acceso sensible.

Las reseñas pertenecen a una operación, no directamente a un vendedor. Como Alliance Codex no procesa el pago, una compra no puede etiquetarse automáticamente como verificada: comprador y vendedor deben confirmar la operación o el caso queda `disputed/pending_review`. Una sola reseña por comprador y operación; nunca autorreseña. Escala entera de 0 a 5, incluyendo cero. Comentario y captura son evidencia aportada, no prueba concluyente. Editar/eliminar debe dejar auditoría, con ventana de corrección y apelación moderada. Los promedios mostrarán número de reseñas y distribución, nunca sólo estrellas o un badge de “confiable”.

La captura de reseña se almacena en bucket privado, no en URL pública permanente. Validar MIME y firma, dimensiones y tamaño, retirar metadatos, revisar contenido sensible y usar URLs temporales para acceso autorizado. Por defecto, sólo comprador, vendedor involucrado y moderadores pueden verla; publicación pública exige consentimiento y revisión/redacción explícitos. No almacenar datos bancarios, números telefónicos ni comprobantes con información personal visible en reseñas públicas.

Gate técnico: diseño de tablas `seller_profiles`, `trade_listings`, `trade_transactions`, `trade_reviews`, `trade_review_evidence`, `trade_reports` y `trade_moderation_events`; RLS deny-by-default y pruebas de propietario, comprador, vendedor, tercero y moderador; rate limits y protección de spam; política de retención/borrado. La visibilidad pública sólo comienza después de verificación real y aceptación manual con cuentas de prueba. No aplicar migraciones remotas ni abrir publicación desde este borrador local.

## Huecos conocidos

El roster actual contiene 910 variantes, pero no cubre todos los campos objetivo. `content/system-items.json` sólo tiene una muestra; el catálogo de items, addons y auras llega con los registros de D-011, con valores de relleno (`null`, «—») hasta que el propietario los complete, incluidos Balls, Helds y precios NPC. Las wikis comunitarias sirven de referencia, no prueban vigencia. Las dos capturas del propietario muestran atributos y entrenamiento; no autorizan copiar arte del cliente ni prueban los límites del sistema.
