# Notificaciones de la app Android (FCM)

La web envía avisos por **Web Push** (claves VAPID). La app nativa de Android los recibe por **Firebase Cloud Messaging (FCM)**.
Los dos canales conviven: el servidor decide qué avisos tocan y los reparte según el tipo de cada dispositivo registrado
(`notification_endpoints.kind` = `webpush` o `fcm`).

```
Worker de Cloudflare (cada 5 min) → /api/internal/reminders/tick → plan de recordatorios
                                                                       │
                              ┌────────── RoutingSender ──────────────┤
                              ▼                                        ▼
                    Web Push (VAPID) → navegador            FCM (cuenta de servicio) → app Android
```

## 1. Crear el proyecto de Firebase (una vez, ~5 minutos)
1. Entra en <https://console.firebase.google.com> con tu cuenta de Google y pulsa **Crear un proyecto** (por ejemplo `serenboard`). Google Analytics no hace falta.
2. En el proyecto: **Configuración del proyecto** (engranaje) → pestaña **General** → **Tus apps** → icono de Android.
   - **Nombre del paquete de Android:** `io.github.xrndev.serenboard` (exactamente así).
   - Apodo: `Serenboard`. No hace falta el certificado SHA-1.
   - Pulsa **Registrar app** y **Descargar google-services.json**. El resto de pasos del asistente se pueden saltar.
3. Copia `google-services.json` a `native/mobile/google-services.json`. No es un secreto (lo lleva cualquier APK), así que puede ir al repositorio.
4. Misma pantalla de configuración → pestaña **Cuentas de servicio** → **Generar nueva clave privada**. Se descarga un `.json`: **este sí es secreto**, no lo subas al repositorio ni lo pegues en ningún chat.

> Comprueba que en **Configuración → Cloud Messaging** aparece **API de Firebase Cloud Messaging (V1): Habilitada**. Si no, actívala desde el enlace que muestra.

## 2. Dar la clave al servidor
En tu PC (Git Bash), con la ruta del `.json` descargado:

```bash
base64 -w0 ruta/al/clave-de-servicio.json
```

Pega el resultado en el `.env` de la VPS como una sola línea y reinicia:

```bash
ssh root@VPS
cd /opt/taskzen && nano .env        # añade: FCM_SERVICE_ACCOUNT_B64=<lo que copiaste>
docker compose up -d
```

Después borra el `.json` descargado de tu PC.

## 3. Compilar la app
Con `google-services.json` en `native/mobile/`, compila el APK (ver `native/mobile/Dockerfile.android`) y publícalo.
Sin ese archivo la app compila igualmente, pero en **Mi perfil → Notificaciones** avisa de que esa versión no incluye los avisos.

## 4. Usarlo
**Mi perfil → Notificaciones → Activar avisos en este móvil** (Android pide el permiso) → **Enviar prueba**.
Los avisos de vencimiento llegan según las antelaciones que elijas; los de asignación, al momento. Tocar un aviso abre la tarea.

## Cómo funciona por dentro
- `src/server/push/fcm.ts`: `FcmSender`. Firma un JWT RS256 con la clave de la cuenta de servicio, lo cambia por un token OAuth de 1 h
  (se reutiliza) y envía a la API HTTP v1 de FCM. 404 o `UNREGISTERED` = el móvil ya no existe y se da de baja; 429/5xx/red son transitorios.
- `src/server/push/sender.ts`: `RoutingSender` reparte cada aviso al canal de su destino. Con solo uno configurado, el otro se ignora.
- API de la app (`/api/v1/notifications`): estado, preferencias, registro y baja del token, y prueba. Los casos de uso son los mismos que usa la web.
- Al cerrar sesión, la app quita su token del servidor: el siguiente que use el móvil no recibe los avisos de la cuenta anterior.
