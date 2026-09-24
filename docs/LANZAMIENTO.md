# Lanzamiento de las cuentas y de Comercio fase B

Guía para el propietario: qué cuenta crear en cada servicio, qué ajustes poner, qué clave va en qué variable y en qué orden, para encender en producción el registro de §9.15.1, la fase B de Comercio (§9.9–§9.12 con las decisiones de §9.15) y la entrada de cuenta de §9.16. Todo lo de esta guía lo hace el propietario, o un agente con su autorización expresa para ese paso: ningún agente toca el proyecto remoto por su cuenta (OG-1).

Hasta el último paso, producción no cambia: sin `COMERCIO_PUBLICO` el sitio no publica nada de la fase B, y cada proveedor sin su variable no dibuja su botón (S11).

## Antes de empezar

- **Decisiones pendientes** (§9.13): D-B5 (otras plataformas de contacto), D-B6 (moderadores y parámetros de §9.12.6 y §9.15.8) y D-B7 (términos, edad y privacidad). Los borradores de D-B7 están en [`docs/legal/`](legal/): el propietario los revisa y aprueba antes de publicarlos. Sin moderador no hay lanzamiento.
- **Un dominio propio.** Resend solo envía desde un dominio verificado por DNS, y un subdominio de `vercel.app` no se puede verificar. Añade el dominio al proyecto de Vercel (Settings → Domains) y usa ese dominio en todos los pasos donde aparece `<dominio>`.
- **La URL de callback de Supabase.** Los proveedores OAuth vuelven a `https://<ref>.supabase.co/auth/v1/callback`, donde `<ref>` es la referencia del proyecto. El panel de Supabase la muestra, lista para copiar, en la ficha de cada proveedor («Callback URL»). En local es `http://127.0.0.1:54321/auth/v1/callback`.

## Qué va dónde

| Dato                                                                                 | Dónde se pega                                                                                                                           | ¿Público?               |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| URL del proyecto y clave anon o publishable (Supabase → Project Settings → API Keys) | Vercel: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`                                                                               | Sí                      |
| Clave `service_role` o secret                                                        | Nunca en una variable `PUBLIC_`. Solo en Vercel, marcada «Sensitive», si una función del servidor la pide (`SUPABASE_SERVICE_ROLE_KEY`) | No                      |
| API key de Resend                                                                    | Supabase → Authentication → Emails → SMTP Settings, campo «Password»                                                                    | No                      |
| Site key de Turnstile                                                                | Vercel: `PUBLIC_TURNSTILE_SITE_KEY`                                                                                                     | Sí                      |
| Secret key de Turnstile                                                              | Supabase → Authentication → Attack Protection, campo «Captcha secret»                                                                   | No                      |
| Client ID y Client Secret de Discord                                                 | Supabase → Authentication → Sign In / Providers → Discord                                                                               | El ID sí; el secreto no |
| Client ID y Client secret de Google                                                  | Supabase → Authentication → Sign In / Providers → Google                                                                                | El ID sí; el secreto no |
| Client ID y Client Secret de Twitch                                                  | Supabase → Authentication → Sign In / Providers → Twitch                                                                                | El ID sí; el secreto no |
| Account SID, Auth Token y Verify Service SID de Twilio (más adelante)                | Supabase → Authentication → Sign In / Providers → Phone                                                                                 | No                      |

Las variables `SUPABASE_AUTH_*` de `.env.example` son solo para la pila local (`supabase/.env`): el proyecto remoto toma esos valores de su panel, nunca de un archivo. Las variables de Vercel se leen al construir el sitio: después de cambiar una, vuelve a desplegar (Deployments → Redeploy).

## Orden

1. Aplicar las migraciones pendientes en el proyecto remoto.
2. Resend: dominio, API key y SMTP de Supabase.
3. Ajustes de Auth en Supabase y plantilla del correo de confirmación.
4. Discord.
5. Google.
6. Twitch (opcional).
7. Cloudflare Turnstile: primero la site key en Vercel, después el secreto en Supabase.
8. Hook `before_user_created`.
9. Lista pública de dominios de correo desechable (opcional).
10. Moderadores.
11. Textos legales publicados y `COMERCIO_PUBLICO=1` en Vercel.
12. Comprobación en producción.

Twilio Verify queda para más adelante (último apartado).

## 1. Migraciones remotas

En remoto faltan las migraciones que `supabase migration list --linked` muestre sin aplicar: al menos `20260918220000_remove_provenance.sql` y `20260923150000_guild_admin.sql`, y las dos de M14 (`*_account_trust.sql` y `*_trade_marketplace.sql`). `db push` las aplica en el orden de su fecha. Cuando el propietario lo confirme, desde la carpeta del repositorio, con la CLI de Supabase y la sesión del propietario:

```powershell
# Qué hay en local y qué hay en remoto.
supabase migration list --linked
# Respaldo antes de tocar nada: esquema y datos, en dos archivos fuera de Git.
supabase db dump --linked -f respaldo-esquema.sql
supabase db dump --linked --data-only -f respaldo-datos.sql
# Lo que se aplicaría, sin aplicarlo.
supabase db push --linked --dry-run
# Aplica en orden las pendientes y las anota en el historial del proyecto.
supabase db push --linked
```

- No pegues las migraciones a mano en el SQL Editor: el historial no las anotaría y el siguiente `db push` las intentaría otra vez.
- Nunca `supabase db reset --linked`: borra la base remota.
- Después de `remove_provenance`, el reintento heredado de `src/lib/supabase/guilds.ts` ya puede quitarse.
- La migración `account_trust` siembra `blocked_email_domains` con una lista corta; el paso 9 la amplía.

## 2. Resend (correo de Auth)

Supabase envía el código de confirmación, el enlace para cambiar la contraseña y el aviso de cambio de correo. Su servidor de correo incluido tiene un límite de envío pensado para pruebas (D-B2); en producción los envía Resend.

1. Crea una cuenta en [resend.com](https://resend.com) (plan gratuito; revisa sus límites en su página de precios).
2. Domains → Add Domain → `<dominio>`. Resend da registros DNS (SPF, DKIM y, recomendado, DMARC): añádelos en el proveedor DNS del dominio y espera a que el dominio figure como verificado.
3. API Keys → Create API Key, con permiso «Sending access» limitado a `<dominio>`. Se ve una sola vez: pégala directamente en Supabase.
4. En Supabase → Authentication → Emails → SMTP Settings, activa el SMTP propio:

   | Campo        | Valor                |
   | ------------ | -------------------- |
   | Sender email | `no-reply@<dominio>` |
   | Sender name  | `Alliance Codex`     |
   | Host         | `smtp.resend.com`    |
   | Port         | `465`                |
   | Username     | `resend`             |
   | Password     | la API key de Resend |

   Resend también tiene una integración con Supabase (Resend → Integrations) que rellena estos campos.

5. Con SMTP propio, Authentication → Rate Limits deja fijar cuántos correos por hora envía Auth. Ajústalo al plan de Resend.
6. Prueba: pide «¿Olvidaste tu contraseña?» con tu propio correo y comprueba que llega desde `<dominio>`.

## 3. Ajustes de Auth en Supabase

Los mismos que `supabase/config.toml` fija en local (§9.12.4, §9.15.7):

- **Authentication → URL Configuration:** «Site URL» `https://<dominio>`; en «Redirect URLs», `https://<dominio>/**`. Si `pokealliance-codex.vercel.app` sigue sirviendo el sitio, añade también `https://pokealliance-codex.vercel.app/**`.
- **Authentication → Sign In / Providers:**
  - «Allow new users to sign up»: activado.
  - «Allow manual linking»: activado. El paso 2 del registro vincula Discord o Google a una cuenta que ya existe.
  - «Allow anonymous sign-ins»: desactivado.
  - «Confirm email»: activado.
  - En el proveedor Email: «Secure email change» activado, «Minimum password length» `10` (`CONTRASENA_MIN`), «Email OTP length» `6` y «Email OTP expiration» `3600`.
- **Authentication → Emails → Templates → «Confirm signup»:** el paso 1 del registro pide el código de 6 dígitos del correo, y la plantilla por defecto del panel solo trae el enlace. Añade `{{ .Token }}` al cuerpo, por ejemplo:

  ```html
  <h2>Alliance Codex</h2>
  <p>Tu código de confirmación / Your confirmation code: <strong>{{ .Token }}</strong></p>
  <p><a href="{{ .ConfirmationURL }}">Confirmar correo / Confirm email</a></p>
  ```

  Las demás plantillas pueden quedarse como están: «Reset password» abre `/{l}/cuenta/`, que pide la contraseña nueva.

## 4. Discord

Es una de las dos identidades del paso 2 y la que exige Comercio: una cuenta de Discord con al menos 60 días (`DISCORD_EDAD_MIN_DIAS`), calculados de su id.

1. En [discord.com/developers/applications](https://discord.com/developers/applications), «New Application» con el nombre `Alliance Codex`.
2. OAuth2 → Redirects: añade la URL de callback del proyecto remoto y, para probar en local, `http://127.0.0.1:54321/auth/v1/callback`.
3. En la misma página, copia el «Client ID» y genera el «Client Secret» («Reset Secret»).
4. Supabase → Authentication → Sign In / Providers → Discord: actívalo y pega los dos valores.
5. Vercel: `PUBLIC_AUTH_DISCORD=1`. Sin esta variable el sitio no dibuja «Vincular Discord».

## 5. Google

1. En [console.cloud.google.com](https://console.cloud.google.com), crea un proyecto `Alliance Codex`.
2. Google Auth Platform (antes «OAuth consent screen»):
   - Branding: nombre de la app, correo de soporte y, en «Authorized domains», `<dominio>` y `<ref>.supabase.co`.
   - Audience: «External». Mientras la app esté en «Testing» solo entran los usuarios de prueba que añadas; para abrirla a todos, publícala («Publish app», estado «In production»).
   - Data Access: los alcances `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`.
3. Clients → Create client → «Web application»:
   - «Authorized JavaScript origins»: `https://<dominio>`.
   - «Authorized redirect URIs»: la URL de callback del proyecto remoto y, para local, `http://127.0.0.1:54321/auth/v1/callback`.
4. Copia el «Client ID» y el «Client secret» a Supabase → Authentication → Sign In / Providers → Google y actívalo.
5. Vercel: `PUBLIC_AUTH_GOOGLE=1`.

## 6. Twitch (opcional)

Solo da una insignia en el perfil (§9.15.1).

1. La cuenta de Twitch necesita la verificación en dos pasos activada. En [dev.twitch.tv/console](https://dev.twitch.tv/console) → Applications → «Register Your Application»:
   - Name: `Alliance Codex`.
   - OAuth Redirect URLs: la URL de callback del proyecto remoto. Twitch solo acepta `https` o `http://localhost`: para probar en local usa `http://localhost:54321/auth/v1/callback` y pon ese mismo valor en `SUPABASE_AUTH_EXTERNAL_TWITCH_REDIRECT_URI` de `supabase/.env`.
   - Category: «Website Integration»; Client Type: «Confidential».
2. «Manage» → copia el «Client ID» y genera un «New Secret».
3. Supabase → Authentication → Sign In / Providers → Twitch: actívalo y pega los dos valores.
4. Vercel: `PUBLIC_AUTH_TWITCH=1`.

## 7. Cloudflare Turnstile (CAPTCHA)

Comprobación invisible en el alta, el inicio de sesión y la recuperación de contraseña (D-B3).

1. Crea una cuenta en [cloudflare.com](https://dash.cloudflare.com) (no hace falta mover el dominio a Cloudflare).
2. Turnstile → «Add widget»: nombre `Alliance Codex`, «Hostnames» `<dominio>` (y `pokealliance-codex.vercel.app` si sigue en uso), modo «Invisible».
3. Copia la «Site Key» a Vercel (`PUBLIC_TURNSTILE_SITE_KEY`) y vuelve a desplegar.
4. **Solo después**, en Supabase → Authentication → Attack Protection, activa «Enable Captcha protection», elige Turnstile y pega la «Secret Key». En el orden contrario, nadie podría entrar mientras el sitio desplegado no envía el token.

En local se usan las claves de prueba de Cloudflare, que siempre pasan: site key `1x00000000000000000000BB` y secreto `1x0000000000000000000000000000000AA` (`.env.example`).

## 8. Hook `before_user_created`

Rechaza un alta con un correo normalizado que ya tiene otra cuenta (baneadas incluidas) o con un dominio de `blocked_email_domains` (§9.15.1). La función llega con la migración `account_trust`, así que este paso va después del paso 1.

Supabase → Authentication → Hooks → «Add hook» → «Before User Created»: tipo Postgres, esquema `public`, función `hook_before_user_created`. Prueba: un alta con `alguien+x@gmail.com` cuando ya existe `alguien@gmail.com` debe fallar.

## 9. Lista pública de dominios de correo desechable

La migración trae una lista corta escrita a mano. Para bloquear más dominios, carga una lista pública mantenida, por ejemplo el archivo `disposable_email_blocklist.conf` del repositorio `disposable-email-domains/disposable-email-domains` de GitHub (un dominio por línea; revisa su licencia y su fecha de actualización). No hace falta copiarla al repositorio.

En Supabase → SQL Editor, una sola sentencia: sustituye la línea `(pega aquí el archivo)` por el contenido completo del archivo y ejecútala.

```sql
insert into public.blocked_email_domains (domain)
select distinct lower(btrim(linea))
from regexp_split_to_table($lista$
(pega aquí el archivo)
$lista$, '\r?\n') as linea
where lower(btrim(linea)) ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'
on conflict (domain) do nothing;
```

- `regexp_split_to_table` parte el texto en líneas; el `where` deja fuera líneas vacías, comentarios y cualquier cosa que no sea un dominio; `on conflict` salta los que ya están, así que la misma sentencia sirve para actualizar la lista más adelante.
- `select count(*) from public.blocked_email_domains;` dice cuántos hay.
- Si un dominio legítimo queda bloqueado: `delete from public.blocked_email_domains where domain = 'ejemplo.com';`.
- En local funciona igual con `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f dominios.sql`; un `supabase db reset` la borra y deja solo la semilla de la migración.

## 10. Moderadores

Sin moderador no hay lanzamiento (D-B6). Cada moderador es una cuenta del sitio con el registro completo. En Supabase → Authentication → Users copia su «User UID» y, en el SQL Editor:

```sql
insert into public.trade_moderators (user_id) values ('<User UID>');
```

Para quitarlo: `delete from public.trade_moderators where user_id = '<User UID>';`. El menú de cuenta muestra «Moderación» solo a estas cuentas.

## 11. Encender Comercio fase B

1. Textos legales: el propietario aprueba los borradores de `docs/legal/` (D-B7) y se publican como páginas del sitio; la casilla del paso 3 del registro enlaza a ellas. Si el texto de los términos cambia después, sube su versión (`TERMINOS_VERSION` y, para el aviso de dinero real, `CONSENTIMIENTO_DINERO_REAL_VERSION`, en `src/lib/trade/limits.ts`) y el sitio la vuelve a pedir.
2. Variables de Vercel en «Production»:

   | Variable                                          | Valor                                         |
   | ------------------------------------------------- | --------------------------------------------- |
   | `PUBLIC_SITE_URL`                                 | `https://<dominio>`                           |
   | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | Los del proyecto remoto                       |
   | `PUBLIC_TURNSTILE_SITE_KEY`                       | Paso 7                                        |
   | `PUBLIC_AUTH_DISCORD`, `PUBLIC_AUTH_GOOGLE`       | `1`, cada una después de activar su proveedor |
   | `PUBLIC_AUTH_TWITCH`                              | `1` solo si hiciste el paso 6                 |
   | `COMERCIO_PUBLICO`                                | `1`, el último                                |
   | `COMERCIO_DEMO`                                   | Vacía. Nunca en producción                    |
   | `TELEFONO_OBLIGATORIO`                            | Vacía hasta que Twilio esté listo             |

3. Vuelve a desplegar.

## 12. Comprobación en producción

Con una cuenta propia y otra de prueba:

- Crear cuenta: llega el correo con el código desde `<dominio>`, se vincula Discord o Google y se completa el perfil.
- Un segundo registro con el mismo correo normalizado o con un dominio desechable falla.
- La cabecera muestra «Iniciar sesión» sin sesión y el chip de cuenta con sesión; «Cerrar sesión» vuelve a «Iniciar sesión».
- En `/es/comercio/`, un visitante sin sesión ve el aviso de mayoría de edad; una cuenta menor de 18 no entra.
- Publicar un anuncio con dinero real pide el consentimiento una vez.
- «Contactar al vendedor» revela el contacto solo a las dos partes; un tercero ve solo etiquetas.
- Un moderador ve `/es/comercio/moderacion/`; otra cuenta no.

## Más adelante: Twilio Verify (teléfono)

El paso del teléfono está construido y apagado mientras el SMS no se pueda pagar (D-B1, `TELEFONO_OBLIGATORIO`). Para encenderlo:

1. Cuenta en [twilio.com](https://www.twilio.com). Verify cobra por verificación: revisa la tarifa vigente en su página de precios.
2. Console: copia el «Account SID» y el «Auth Token». Verify → Services → «Create new»: nombre `Alliance Codex`, canal SMS; copia el «Service SID».
3. Supabase → Authentication → Sign In / Providers → Phone: actívalo, proveedor «Twilio Verify», y pega los tres valores (el Service SID va en el campo del servicio de Verify). Activar Phone también permite entrar con un código por SMS; el registro de tres pasos sigue siendo obligatorio, porque las funciones de cuenta y de Comercio exigen la cuenta completa.
4. Vercel: `TELEFONO_OBLIGATORIO=1` y volver a desplegar. El teléfono pasa a ser el paso 2b del registro y una insignia.

En local, el número de prueba `+1 202 555 0123` recibe siempre el código `123456` sin enviar SMS (`supabase/config.toml`).

## Probar en local

- La pila local corre en Podman: con `CONTAINERS_MACHINE_PROVIDER=wsl`, `podman machine start podman-machine-default` y después `supabase start -x vector,logflare,studio,imgproxy,edge-runtime,postgres-meta,realtime,storage-api,supavisor`. La API queda en `http://127.0.0.1:54321` y el correo en Mailpit, `http://127.0.0.1:54324`. Las migraciones se aplican con `supabase migration up` o `supabase db reset`, nunca contra el remoto.
- `supabase/.env` (Git lo ignora) recibe las variables `SUPABASE_AUTH_*` de `.env.example`: por ejemplo `SUPABASE_AUTH_CAPTCHA_ENABLED=true` con el secreto de prueba, o las de Discord y Google con apps que tengan la URL de callback local. Después, `supabase stop` y `supabase start` para que la pila las lea.
- El sitio en local lee `.env.local` por encima de `.env`, que apunta al proyecto remoto: pon ahí `PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `PUBLIC_SUPABASE_ANON_KEY` (lo imprime `supabase status -o env`), `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000BB`, `COMERCIO_PUBLICO=1` y las `PUBLIC_AUTH_*` de los proveedores que encendiste en la pila.
