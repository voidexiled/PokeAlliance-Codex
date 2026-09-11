# Dirección de diseño — Wiki moderna

Estado: referencia visual aprobada y shell wiki implementado  
Última actualización: 2026-09-09

## Corrección de alcance

La interfaz creada durante la fundación y la primera entrega de Wiki Core es un prototipo técnico funcional, no el diseño final de Alliance Codex. El shell actual tomó decisiones visuales sin una fase de diseño aprobada y no debe utilizarse como referencia para continuar el producto.

La dirección confirmada por el propietario es:

- Alliance Codex debe sentirse como una wiki moderna y completa, no como una landing page.
- La navegación principal debe organizar el conocimiento de la wiki; no presentar un conjunto de acciones de producto como si fuera un dashboard.
- Las herramientas deben vivir dentro de la wiki, agrupadas en un apartado de Herramientas, y compartir búsqueda, navegación, fuentes y lenguaje visual con los artículos.
- La prioridad visual es leer, explorar y encontrar información del juego: categorías, índices, artículos, breadcrumbs, búsqueda, navegación contextual y procedencia.
- La referencia visual aprobada son las tres capturas de una wiki moderna compartidas por el propietario el 2026-09-09. Se usa como criterio de estructura y densidad, no como permiso para copiar marca, textos o assets.

## Referencia aprobada y decisiones implementadas

Las capturas fijan una wiki documental sobria y densa, con información visible sin ruido:

- barra superior global con identidad pequeña, búsqueda centrada e idioma;
- navegación lateral persistente, agrupada por áreas y con estado activo;
- portada como índice de acceso y categorías, no como hero comercial;
- fichas con breadcrumbs, título, secciones, resumen contextual y procedencia;
- herramientas y cambios dentro de la navegación de la wiki;
- paneles compactos, bordes discretos, una paleta oscura neutra y un solo acento funcional;
- estados vacíos y límites editoriales expresados directamente, sin métricas decorativas.

El shell implementado en `src/layouts/AppLayout.astro` y `src/styles/global.css` sigue esta dirección. La portada, Pokédex, ficha de Pokémon, herramientas, cambios y páginas de procedencia se adaptaron sin alterar los contratos de datos.

## Criterio de autoría y calidad anti-IA

La aplicación no debe parecer escrita por un generador automático. Esto aplica tanto al diseño como a los textos, nombres de secciones, descripciones, estados y ejemplos.

### Contenido

- Escribir con voz editorial directa, concreta y propia de una wiki de juego; describir qué es algo, cómo se obtiene o qué condición tiene.
- Usar los nombres, términos y diferencias que realmente aparecen en PokeAlliance y en las fuentes revisadas; no inventar sinónimos para sonar más creativo.
- No usar slogans, metáforas de marketing ni frases genéricas como “lleva tu experiencia al siguiente nivel”, “centro de conocimiento”, “catálogo vivo” o equivalentes.
- No rellenar fichas con texto de transición, resúmenes obvios, claims no respaldados, cifras redondas falsas o ejemplos inventados.
- Mostrar “desconocido”, “no publicado por la fuente” o “pendiente de revisión” cuando corresponda. La ausencia de información también es información.
- Mantener una separación visible entre dato del juego, interpretación de una guía, observación del cliente y aporte comunitario.
- Redactar cada idioma como una versión editorial revisada; no publicar traducciones mecánicas que cambien términos canónicos.

### Diseño

- Evitar la huella visual de interfaces generadas: gradientes decorativos, exceso de badges, paneles de métricas sin función, filas repetitivas de tarjetas, iconos intercambiables y jerarquías de “hero + CTA”.
- Los componentes deben existir porque ayudan a leer, comparar, navegar o verificar un dato; si sólo decoran, no se justifican.
- Preferir una jerarquía de wiki reconocible: navegación de secciones, índice, artículo, enlaces relacionados, historial/procedencia y estados editoriales.
- Introducir variación sólo cuando tenga una razón de contenido: una ficha, una tabla, una lista, una advertencia o una herramienta no deben verse como la misma tarjeta con distinto texto.
- Usar estados de carga, vacío y error escritos para la situación concreta, con una acción clara y sin dramatización.

### Revisión obligatoria

Antes de aceptar una pantalla, revisar:

1. ¿Podría existir este texto en cualquier producto genérico sin cambiar una palabra? Si sí, reescribirlo.
2. ¿El componente ayuda a encontrar, entender o verificar información? Si no, eliminarlo.
3. ¿Cada cifra, nombre, fecha y afirmación tiene una fuente o está marcado como pendiente?
4. ¿La pantalla se siente como una página de wiki o como una landing/dashboard?
5. ¿La traducción mantiene la terminología canónica y la intención editorial?

## Modelo de experiencia a diseñar

La propuesta base que deberá validarse antes de codificar el rediseño es una estructura de documentación/wiki:

1. Barra superior global con identidad, búsqueda prominente, idioma y acciones de cuenta cuando existan.
2. Navegación lateral de secciones de conocimiento, colapsable en pantallas pequeñas.
3. Columna principal de artículo o índice, con jerarquía editorial y enlaces internos.
4. Columna contextual opcional para tabla de contenidos, metadatos, fuentes y acciones de artículo.
5. Breadcrumbs y navegación de retorno en cada superficie profunda.
6. Herramientas como una sección de contenido de primer nivel, no como un producto visualmente separado.
7. Home tipo portal de wiki: búsqueda, navegación por categorías, cambios recientes y accesos a conocimiento; sin hero comercial ni panel de métricas como foco principal.

Las capturas del propietario convierten esta arquitectura en la dirección aprobada para la primera versión visual. El detalle de tokens y reglas de uso queda registrado en el shell y en este documento.

## Gate de diseño

El gate quedó satisfecho con las capturas proporcionadas por el propietario. Las restricciones para continuar son:

- mantener la estructura de wiki y evitar regresar a un shell de landing o dashboard;
- conservar textos concretos, terminología canónica y separación entre hechos, fuentes y pendientes;
- no convertir herramientas, cambios o Server Save en superficies promocionales;
- revisar cada nueva pantalla contra la lista anti-IA y contra la densidad de las capturas.

El design system inicial ya fue producido en el shell: tokens semánticos, tipografía Geist, layout lateral, tabla/lista documental, paneles compactos, breadcrumbs, tabla de contenidos, búsqueda, estados vacíos y responsive.

## Qué queda descartado del shell provisional

- Home dominada por un hero de producto o una tarjeta de readiness.
- Tarjetas de métricas como sustituto de la navegación de conocimiento.
- Barra superior como única estructura de exploración.
- La estética oscura/acento del prototipo anterior como decisión de marca; la versión actual la redujo a una base neutra y un acento funcional.
- Cualquier nueva pantalla visual construida sobre estas decisiones sin pasar el gate de diseño.

## Preservar mientras se rediseña

El rediseño debe conservar la funcionalidad ya verificada: rutas localizadas, repositorio de contenido, búsqueda, evidencia/procedencia, Server Save con Temporal, contratos de datos, pruebas y límites de Supabase. La corrección es visual y de arquitectura de información; no autoriza perder datos ni reescribir la base técnica sin una razón independiente.
