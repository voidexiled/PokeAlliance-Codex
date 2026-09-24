# Política de privacidad de Alliance Codex

> **BORRADOR** para que el propietario lo revise (D-B7, §9.13). No se publica hasta que el propietario lo apruebe. Está escrito a partir de las decisiones de §9.15 y §9.16 de la especificación y no es asesoría legal. Lo que va entre corchetes lo decide o lo completa el propietario.

Versión: 2026-09-23.

## 1. Responsable

[Nombre o alias del responsable], contacto: [correo de contacto]. Alliance Codex es un proyecto independiente, no afiliado a PokeAlliance.

## 2. Qué datos se tratan y para qué

Leer la wiki no requiere cuenta ni datos personales.

| Dato                                                                                                                       | Cuándo                                                                                                                                                  | Para qué                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Correo y contraseña (la contraseña se guarda cifrada con hash)                                                             | Al registrarte                                                                                                                                          | Entrar, confirmar el correo con un código y recuperar la contraseña                                                            |
| Correo normalizado (en minúsculas, sin la parte `+etiqueta` y, en Gmail, sin puntos)                                       | Al registrarte                                                                                                                                          | Impedir que un mismo correo abra varias cuentas                                                                                |
| Cuenta de Discord o de Google vinculada: su identificador, nombre de usuario, avatar y el correo que comparte el proveedor | Paso 2 del registro                                                                                                                                     | Anclar la cuenta a una persona; calcular la antigüedad de la cuenta de Discord a partir de su identificador; mostrar el avatar |
| Cuenta de Twitch u otra plataforma (opcional)                                                                              | Si la vinculas                                                                                                                                          | Mostrar una insignia y, si lo eliges, usarla como canal de contacto                                                            |
| Nombre de usuario, nombre del jugador y mundo, país                                                                        | Paso 3 del registro                                                                                                                                     | Tu perfil y Comercio                                                                                                           |
| Fecha de nacimiento                                                                                                        | Paso 3 del registro                                                                                                                                     | Comprobar la edad mínima (13 años para la cuenta, 18 para Comercio). Nunca se muestra                                          |
| Versión y fecha de los términos aceptados y del aviso de dinero real                                                       | Al aceptarlos                                                                                                                                           | Saber qué aceptaste y cuándo                                                                                                   |
| Teléfono                                                                                                                   | Solo si el sitio activa la verificación por teléfono                                                                                                    | Verificarlo y mostrar una insignia                                                                                             |
| Estado en línea: el estado que eliges y la hora de la última señal y de la última actividad                                | Con una sesión abierta, una señal por minuto                                                                                                            | Mostrar «En el juego», «Ausente» o «Desconectado»                                                                              |
| Anuncios, operaciones, reseñas, reportes y canales de contacto                                                             | Al usar Comercio                                                                                                                                        | Prestar el servicio de Comercio                                                                                                |
| IP de la conexión e identificador aleatorio del navegador                                                                  | Solo en acciones de Comercio (publicar, contactar, confirmar, cancelar, disputar, reseñar y reportar) y solo después de aceptar el aviso de dinero real | Revisar reportes y alertas, y aplicar los límites de ritmo                                                                     |
| Acciones de moderación y su motivo                                                                                         | Cuando la moderación actúa                                                                                                                              | Registrar cada decisión                                                                                                        |
| Guilds, sus cortes y sus miembros                                                                                          | Si usas Guild con tu cuenta                                                                                                                             | Guardar el historial de tus guilds                                                                                             |
| Datos técnicos del navegador                                                                                               | En el registro, el inicio de sesión y la recuperación de contraseña                                                                                     | Distinguir personas de bots (Cloudflare Turnstile)                                                                             |

El sitio no pide nombre real, documento de identidad ni domicilio.

## 3. Qué es público

Tu nombre de usuario, tus anuncios, las reseñas que das y recibes con tu nombre de usuario, tu reputación, tu estado en línea en Comercio, tus insignias y la etiqueta (no el valor) de los canales de contacto que eliges mostrar.

No son públicos: tu correo, tu fecha de nacimiento, tu teléfono, el valor de tus canales de contacto, tu IP ni el identificador de tu navegador. El valor de un canal de contacto solo lo ven la otra parte de una operación y los moderadores. [El propietario decide si el nombre del jugador y el mundo son públicos o solo los ven la contraparte de una operación y los moderadores.]

## 4. IP e identificador del navegador

- Se registran solo en las acciones de Comercio del punto 2 y solo después de que aceptes el aviso de dinero real.
- El identificador del navegador es un valor aleatorio que el sitio guarda en tu navegador; no identifica tu equipo fuera de este sitio.
- Solo los ven los moderadores, nunca se publican y no se usan para bloquear por IP: una IP compartida no da lugar a ninguna medida por sí sola.
- Se conservan 90 días, salvo los ligados a un reporte o a una alerta abierta, que se conservan mientras sigan abiertos. El borrado ocurre cuando se registran acciones nuevas, así que un registro puede durar algo más de 90 días.

## 5. Con quién se comparten

Los datos no se venden. [El propietario confirma que el sitio no tiene publicidad.] Los tratan, por encargo del sitio:

- Supabase: base de datos y cuentas. [Región del proyecto.] [Al publicar esta página, la prueba de textos prohibidos de §12.22, que marca «Supabase», necesita una excepción para ella.]
- Vercel: alojamiento del sitio.
- Resend: envío de los correos de la cuenta.
- Cloudflare: la comprobación contra bots (Turnstile).
- Twilio: la verificación por teléfono, solo si el sitio la activa.

Discord, Google y Twitch reciben la solicitud de vinculación cuando vinculas tu cuenta y tratan sus datos según sus propias políticas. Estos proveedores pueden tratar datos fuera de tu país. [El propietario revisa las condiciones de cada proveedor.]

## 6. Cuánto tiempo se guardan

- Los datos de la cuenta, mientras la cuenta exista.
- La IP y el identificador del navegador, como indica el punto 4.
- El estado en línea se reemplaza con cada señal y se borra con la cuenta.
- Al eliminar tu cuenta, tus anuncios se retiran y tus reseñas quedan con el autor «Cuenta eliminada».
- Si la cuenta está suspendida de forma indefinida en Comercio (baneada), al eliminarla se borra todo salvo el correo normalizado, las cuentas de Discord y de Google vinculadas y el nombre del jugador con su mundo, y la cuenta queda bloqueada. Se conservan para que la misma persona no pueda registrarse de nuevo mientras dure la sanción. [Plazo: lo decide el propietario.]
- El registro de acciones de moderación: [plazo: lo decide el propietario].
- Los respaldos del proveedor: [plazo según el plan contratado].

## 7. Lo que el sitio guarda en tu navegador

El sitio no usa cookies de publicidad. Guarda en el almacenamiento local del navegador:

- la sesión de tu cuenta;
- una copia pequeña de tu perfil para la cabecera (nombre de usuario, jugador, mundo, avatar y estado);
- el identificador aleatorio del navegador del punto 4;
- tu respuesta al aviso de mayoría de edad de Comercio, que no se envía al servidor;
- el borrador de un anuncio y el espacio de trabajo de Guild;
- preferencias de la interfaz.

## 8. Tus derechos

Puedes ver y corregir tus datos desde tu cuenta y «Mi perfil», y eliminar tu cuenta con «Eliminar cuenta». La fecha de nacimiento y el nombre de usuario con anuncios publicados no se cambian desde el sitio: para corregirlos, escribe a [correo de contacto]. Si retiras la aceptación del aviso de dinero real, no puedes usar Comercio con dinero real. [Derechos, plazos de respuesta y autoridad de control según la ley aplicable: los completa el propietario con asesoría.]

## 9. Menores

Para crear una cuenta hay que tener al menos 13 años, y para Comercio, 18. Ver la [política de edad mínima](edad.md).

## 10. Cambios

Esta política puede cambiar; cada versión lleva su fecha y, si el cambio afecta a lo que aceptaste, el sitio te pide aceptarla de nuevo.
