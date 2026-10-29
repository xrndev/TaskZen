# Estudio: apps Android e iOS, notificaciones push y recordatorios

Fecha: 21 de octubre de 2026. Las políticas de las tiendas cambian: antes de decidir, repasar las fuentes enlazadas al final.
Se reproduce con `node scripts/audit-mobile-readiness.mjs` y los agentes de `.claude/agents/` (ver el final).

## Resumen

1. **No hace falta una app nativa para tener notificaciones.** Web Push cubre escritorio y Android, e iPhone (iOS 16.4 o superior) si la web está instalada en la pantalla de inicio. No pide cuenta de desarrollador ni pasa por revisión. Es la primera fase y no toca la interfaz actual.
2. **El código está bien posicionado para crecer sin romperse:** los 8 servicios de negocio no dependen de Next.js. Cualquier puerta nueva (worker de recordatorios, API, app) se monta encima sin duplicar reglas.
3. **Hay 6 bloqueos antes de publicar en tiendas** y no son de la interfaz: borrado de cuenta dentro de la app, política de privacidad, dominio propio, y la infraestructura de push (service worker, tablas, programador). Ver la tabla.
4. **Android es barato y limpio** con una Trusted Web Activity. **iOS es caro y arriesgado** si solo envuelve la web; hasta que haya funciones nativas que lo justifiquen, la PWA instalada es la vía recomendada.

## Estado actual (auditoría automática)
`6 BLOQUEO · 6 AVISO · 5 INFO · 6 OK`

| Nivel | Hallazgo | Por qué importa |
|---|---|---|
| BLOQUEO | Sin service worker | El navegador no puede recibir push |
| BLOQUEO | Sin tabla de suscripciones | No hay dónde guardar los dispositivos |
| BLOQUEO | Sin registro de recordatorios enviados | Un reinicio repetiría avisos |
| BLOQUEO | Sin proceso programado | Nada recorre las fechas límite en segundo plano |
| BLOQUEO | **Sin borrado de cuenta en la app** | Lo exige Apple (5.1.1.v) y es obligación RGPD |
| BLOQUEO | **Sin política de privacidad pública** | URL obligatoria en las fichas |
| AVISO | Dominio gratuito (DuckDNS) | Passkeys y enlaces verificados de las apps se atan al dominio |
| AVISO | Login social sin Iniciar con Apple | Apple 4.8 en la build de iOS |
| AVISO | Sin preferencias de notificación | Opt-in y baja obligatorios (Apple 4.5.4) |
| AVISO | Sin capa de capacidades de plataforma | Evitar ramas `if (iOS)` por todo el código |
| AVISO | OAuth y passkeys dentro de un WebView | Google lo bloquea; requieren navegador del sistema y dominio estable |
| OK | Servicios independientes del framework, safe-area, manifest instalable, `100vh` eliminado, pruebas móviles con axe | Base sólida |

Se corrigieron en esta revisión las dos páginas que aún usaban `min-h-screen` (invitación y portada).

## Opciones de empaquetado

| Vía | Esfuerzo de código | Qué cuesta | Riesgo para la web | Veredicto |
|---|---|---|---|---|
| **PWA + Web Push** | Bajo (una fase) | Nada | Ninguno | **Empezar aquí** |
| **TWA** (solo Android) | Mínimo: `assetlinks.json` y empaquetado | Cuenta de Play; prueba cerrada si es personal | Ninguno | **Segundo paso** |
| **Capacitor** (iOS/Android) | Medio | Cuenta de Apple (y de Play) | Bajo si el shell vive en `native/` | Solo con valor nativo real |
| **React Native / Expo** | Alto: segunda interfaz | Igual + mantener dos UI | Alto (divergencia) | No recomendado ahora |

Datos que condicionan la decisión (verificados, con fuente al final):
- Capacitor: `server.url` "carga una URL externa" y la documentación avisa de que **no está pensado para producción**. La alternativa soportada es empaquetar la web, pero entonces las **server actions no funcionan** y habría que exponer una API HTTP sobre los servicios.
- Apple 4.2 pide que la app "eleve" el producto "por encima de un sitio web reempaquetado": un WebView sin funciones nativas tiene riesgo de rechazo.
- Google bloquea el login de OAuth en WebViews incrustados (`disallowed_useragent`): hace falta el navegador del sistema y un relevo de sesión, porque no comparten cookies con la app.

## Cómo no romper la web móvil ni la de escritorio
1. **Capacidades, no plataformas:** una capa `src/lib/platform.ts` y nada de `if (iOS)` en componentes.
2. **El shell nativo vive aparte** (`native/`, con su `package.json`); ninguna dependencia de Capacitor en el paquete raíz. Una regla de ESLint lo vigila.
3. **No cambiar `output: 'standalone'`** ni exportar a estático.
4. **Si hace falta API**, `/api/v1/*` con route handlers finos sobre `src/server/services/*`.
5. **Autenticación nativa por token de un solo uso**, no por cookies compartidas.
6. **Red de seguridad que ya existe:** 37 tests de servicios, 16 pruebas E2E (con una batería móvil que incluye axe y objetivos táctiles de 44 px). Cada fase debe terminar con todo en verde y el escritorio sin cambios visuales (capturas a 1440 px).

## Notificaciones y recordatorios: viabilidad

| Entorno | Web Push | Condición |
|---|---|---|
| Escritorio (Chrome, Edge, Firefox, Safari) | Sí* | Permiso del usuario |
| Android (Chrome) | Sí*, incluso con el navegador cerrado | Permiso del usuario |
| iPhone/iPad (iOS 16.4+) | Sí | Instalada en la pantalla de inicio, manifest `standalone` (ya lo tiene), permiso pedido tras un toque |
| Pestaña de Safari en iPhone | No | — |

\* Conocimiento general, confirmar al implementar. Lo de iOS está contrastado con fuentes (WebKit y notas de Apple); "Declarative Web Push" (iOS 18.4) se anunció en beta y debe confirmarse en la versión final.

**Recordatorios de fecha límite.** Hoy solo existe el aviso dentro de la app (la campana). Para avisar con la app cerrada hace falta:
- Un `worker` (misma imagen, otro comando, unos 100 MB) que cada minuto busque tareas cuya antelación configurada acaba de abrirse.
- Una tabla `reminder_log` con clave única `(tarea, usuario, antelación, fecha)` y reclamar la fila **antes** de enviar: como mucho una vez, nunca duplicados.
- Preferencias por usuario: activadas (opt-in), antelaciones (por ejemplo 1 día y 1 hora), horas de silencio y zona horaria.
- Contenido mínimo: título de la tarea, sin descripciones ni comentarios.

Si algún día hay app nativa, el cambio es **un adaptador más** (FCM en Android, APNs en iOS): el plan de recordatorios, las tablas y el worker no se tocan. Detalle completo en la skill `push-reminders-design`.

## Sin tiendas (decisión actual): APK propio y iPhone

No se publica en ninguna tienda por ahora (cuestan dinero y pasan revisión). Lo que sí se puede repartir:

| Plataforma | Qué se reparte | Coste | Cómo se instala |
|---|---|---|---|
| **Android** | `Serenboard.apk` firmado, servido desde la propia VPS (`/descargas/Serenboard.apk`) | 0 | Descargar, permitir "instalar de esta fuente" y, si aparece, el aviso de Play Protect |
| **iPhone / iPad** | La web instalada como app desde Safari (*Compartir → Añadir a pantalla de inicio*) | 0 | Cualquiera, sin cuenta ni ordenador |

La página pública **`/instalar`** explica ambos casos y trae un código QR para pasárselo a otra persona.

**Por qué no hay un `.ipa` para repartir.** Apple solo permite instalar apps fuera de su tienda a quien tiene una cuenta de desarrollador de pago (TestFlight o distribución interna). Con una cuenta gratuita solo se puede instalar en los propios dispositivos, caduca a los 7 días y requiere un Mac con Xcode o herramientas de terceros. No es una vía para compartir. Para un iPhone ajeno, la web instalada es la única opción gratuita real, y además admite notificaciones (iOS 16.4 o superior) cuando se abre desde el icono.

**Cómo está hecho el APK.** Es una Trusted Web Activity: abre `taskzen.duckdns.org` en Chrome a pantalla completa. No contiene la web, así que **siempre muestra la última versión desplegada** y las actualizaciones no requieren reinstalar. Pesa pocos MB. La web demuestra que la app es suya con `/.well-known/assetlinks.json`. Detalle y comandos en `native/android/README.md`.

## ¿Un Worker de Cloudflare como intermediario de las notificaciones?

**No aporta nada y añade riesgos.** Razonamiento:
- **Enviar un Web Push es una petición HTTPS cifrada** al servicio de notificaciones del navegador. Eso lo hace directamente la VPS con la librería `web-push`. No hay nada que un intermediario resuelva.
- **Lo difícil no es enviar, es decidir cuándo.** Hace falta leer la base de datos, que está en la VPS y no se expone a internet. Un Worker tendría que llamar a un endpoint de la app (un simple temporizador, que el propio `cron` del servidor ya hace gratis) o conectarse a Postgres desde fuera (abrir el puerto, o pagar un túnel o Hyperdrive). Peor seguridad y más piezas.
- **Más puntos de fallo y coste de mantenimiento:** otro servicio, otras credenciales, otro lugar donde mirar los registros.
- **Privacidad:** los datos de las tareas pasarían por un tercero. El cuerpo del Web Push va cifrado de extremo a extremo, pero un Worker que lo construya vería el texto en claro.
- **Si la VPS cae, no hay nada que enviar de todos modos:** los datos están en ella.

Dónde **sí** encajaría Cloudflare, más adelante y con dominio propio: DNS, CDN y protección delante de la web, y un **Worker con cron como vigilante externo** que compruebe `/api/health` y te avise si la VPS no responde (un fallo que la propia VPS no puede avisar).

## Hoja de ruta propuesta

| Fase | Contenido | Orden de magnitud* | Criterio de hecho |
|---|---|---|---|
| **A. Push y recordatorios web** | Service worker, tablas, canal Web Push, worker, ajustes, pruebas | 3 a 5 días | Aviso real en PC, Android y un iPhone con la app instalada; E2E y escritorio sin cambios |
| **B. Requisitos de tienda** | Borrado de cuenta, privacidad y condiciones, exportación de datos, dominio propio | 3 a 4 días + dominio | `audit-mobile-readiness` sin BLOQUEOS |
| **C. Android (TWA)** | **Hecho como APK propio** (`native/android`, `/instalar`). Pendiente: ficha y prueba cerrada si algún día se publica | APK: hecho | Instalable desde un enlace, sin tiendas |
| **D. iOS nativo** | Solo si lo justifica el uso: Iniciar con Apple u ocultar proveedores, API `/api/v1`, relevo de sesión, push APNs, valor nativo | Semanas | Aprobación de revisión |

\* Estimaciones orientativas, no compromisos. Las pruebas en dispositivos reales no están incluidas.

## Lo que no se ha podido verificar
- Comportamiento en un **iPhone y un Android reales**: nada de esto se ha probado en dispositivo; las pruebas actuales usan Chromium con emulación.
- **Importes de las cuentas de desarrollador** (Apple anual, Google pago único): por confirmar en sus páginas.
- Si las cuentas de organización de Google Play están **exentas** de la prueba cerrada, y los requisitos de borrado de cuenta y "Seguridad de los datos" de Play.
- **Passkeys dentro de un WKWebView** y el comportamiento exacto del puente de Capacitor al cargar una web remota.

## Decisiones que necesita el dueño del producto
1. ¿Se compra **dominio propio**? Es el paso previo de casi todo (passkeys, enlaces verificados, fichas).
2. ¿Quién publica: cuenta personal u **organización**? Cambia la prueba de 14 días en Google Play.
3. ¿Es imprescindible estar **en la App Store**, o basta la PWA instalada en iPhone con notificaciones?
4. ¿Empezamos por la Fase A (push y recordatorios)? Es independiente de las demás y sin riesgo para la web.

## Agentes y skills creados
| Elemento | Uso |
|---|---|
| Agente `mobile-architect` | Elegir vía de empaquetado y vigilar los límites de código |
| Agente `push-notifications` | Diseñar e implementar push y recordatorios |
| Agente `store-compliance` | Contrastar el código con las políticas de las tiendas y preparar respuestas de privacidad |
| Agente `mobile-qa` | Red de pruebas móvil y lista de comprobaciones en dispositivo |
| Skill `mobile-readiness-audit` | Procedimiento de auditoría y de informe fechado |
| Skill `push-reminders-design` | Plan de implementación con esquema, pasos y pruebas |
| Skill `store-release-checklist` | Lista ordenada para Google Play (TWA) y App Store |
| Script `scripts/audit-mobile-readiness.mjs` | Auditoría repetible; devuelve código 1 si hay bloqueos |

## Fuentes consultadas
- [App Review Guidelines, Apple](https://developer.apple.com/app-store/review/guidelines/): 4.2, 4.8, 4.5.4 y 5.1.1(v).
- [Account deletion, Apple](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion).
- [Capacitor: configuración](https://capacitorjs.com/docs/config) y [Push Notifications](https://capacitorjs.com/docs/apis/push-notifications).
- [Google: OAuth en WebViews incrustados](https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/).
- [Google Play: requisito de prueba cerrada](https://support.google.com/googleplay/android-developer/answer/14151465).
- [WebKit: Declarative Web Push](https://webkit.org/?p=16535) y [Web Push en iOS, resumen de requisitos](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications) (fuente secundaria).
