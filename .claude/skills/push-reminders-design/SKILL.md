---
name: push-reminders-design
description: Plan completo para implementar notificaciones push y recordatorios de fecha límite en TaskZen (Web Push hoy, FCM/APNs mañana). Úsala al diseñar, implementar o revisar suscripciones, el programador de recordatorios, las preferencias del usuario o su prueba.
---
# Notificaciones push y recordatorios

Objetivo: que quien tenga una tarea asignada reciba un aviso antes de que venza, en PC, Android y iOS, con la app cerrada. Todo es opcional: si no hay permiso, queda el aviso de la campana dentro de la app.

## Qué funciona dónde
Las filas de iPhone/iPad se contrastaron con fuentes (WebKit y notas de Apple). Escritorio y Android son conocimiento general: **confirmar al implementar**. Todo, además, en dispositivo real.
| Entorno | Web Push | Condición |
|---|---|---|
| Chrome / Edge / Firefox de escritorio | Sí | Permiso del usuario |
| Chrome en Android | Sí, con el navegador cerrado | Permiso del usuario; instalada o no |
| Safari de escritorio (macOS 13+) | Sí | Permiso del usuario |
| iPhone/iPad (iOS 16.4+) | Sí | **Instalada en la pantalla de inicio**, manifest `standalone`, permiso pedido **tras un toque** |
| Pestaña de Safari en iPhone | No | — |

## Arquitectura
```
 tarea con due_date ──► worker (cada 60 s, advisory lock)
                           │ ¿ventana de aviso abierta y no enviada?
                           ▼
                 reclama fila en reminder_log  ──► canal (webpush | fcm | apns)
                           │ (UNIQUE evita duplicados)        │
                           ▼                                  ▼
                   notification_endpoints  ◄── 404/410 ⇒ desactivar
```
La decisión de **a quién y cuándo** es una función pura (`planReminders(tasks, prefs, now)`); el envío es un adaptador. Así se prueba sin red.

## Datos (migración Drizzle)
```sql
create table notification_endpoints (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user"(id) on delete cascade,
  kind text not null check (kind in ('webpush','fcm','apns')),
  endpoint text not null unique,          -- URL del servicio push o token del dispositivo
  p256dh text, auth text,                 -- solo Web Push
  user_agent text, created_at timestamptz not null default now(),
  last_ok_at timestamptz, disabled_at timestamptz
);
create table notification_prefs (
  user_id text primary key references "user"(id) on delete cascade,
  enabled boolean not null default false,            -- opt-in explícito
  offsets_minutes integer[] not null default '{1440,60}',
  quiet_start time, quiet_end time, timezone text not null default 'Europe/Madrid'
);
create table reminder_log (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id text not null references "user"(id) on delete cascade,
  offset_minutes integer not null,
  due_at timestamptz not null,            -- si la fecha cambia, se vuelve a avisar
  sent_at timestamptz not null default now(),
  primary key (task_id, user_id, offset_minutes, due_at)
);
```
Borrar el usuario borra todo (cascada): encaja con el requisito de borrado de cuenta.

## Pasos de implementación (cada uno con su prueba)
1. **Función pura `planReminders`** + tests Vitest: ventanas, varios offsets, tareas completadas o sin fecha, horas de silencio, zona horaria y **cambio de hora (DST)**, fecha reprogramada (nuevo `due_at` ⇒ nuevo aviso).
2. **Migración y servicios** `notifications.ts` (guardar/quitar endpoint, preferencias) con permisos: un usuario solo toca los suyos. Test de aislamiento entre usuarios.
3. **Canal Web Push** con `web-push` y claves VAPID en `.env` (`npx web-push generate-vapid-keys`). Manejar 404/410 ⇒ `disabled_at`. 429/5xx ⇒ reintento acotado.
4. **Service worker** `public/sw.js` con `push` (muestra la notificación) y `notificationclick` (abre o enfoca `/board?task=<id>`). No cachear páginas todavía: solo notificaciones, para no arriesgar versiones obsoletas.
5. **Acciones de servidor**: `subscribePushAction`, `unsubscribePushAction`, `updatePrefsAction`, `sendTestPushAction`. Validar con Zod; autorizar con la sesión.
6. **Interfaz** (en el perfil o en "Más"): interruptor de avisos (el permiso se pide **en el clic**), antelaciones, horas de silencio y botón "Enviar prueba". En iPhone, si no está instalada, explicar "Añadir a pantalla de inicio" en vez de un botón que no funcionaría.
7. **Worker**: script en `scripts/worker.mjs` (o servicio en Compose con la misma imagen y otro `command`), `pg_try_advisory_lock`, un ciclo por minuto, límite de lote, registro de métricas (enviadas, fallidas, desactivadas).
8. **Eventos en tiempo real** (asignación, mención): reutilizar `notifyTeam`/LISTEN-NOTIFY y enviar por el mismo canal, con preferencias y deduplicación.
9. **Compose**: añadir `worker` con `mem_limit: 128m`; sin puertos.
10. **Despliegue gradual**: tras VAPID y migración, activar el worker; probar con tu propia cuenta antes de ofrecerlo.

## Privacidad y políticas
- Contenido mínimo: "Vence en 1 h: <título>". Sin descripción, sin comentarios, sin nombres de terceros (Apple 4.5.4: sin información sensible).
- Opt-in explícito y baja inmediata. Un aviso de recordatorio es transaccional; cualquier marketing exigiría consentimiento aparte.
- Registrar el consentimiento (`enabled`, fecha) y borrar endpoints al cerrar sesión en ese dispositivo.

## Riesgos y decisiones abiertas
- **iOS y la instalación**: dependen de que el usuario añada la web a la pantalla de inicio. Medir cuántos lo hacen antes de invertir en nativo.
- **Zona horaria**: guardar la del usuario; `due_date` se almacena en UTC.
- **Duplicados con varias pestañas o dispositivos**: es correcto avisar en todos los dispositivos del mismo usuario, pero una sola vez por dispositivo.
- **Si más adelante hay app nativa**: se añade el adaptador `fcm`/`apns` sin tocar `planReminders`, las tablas ni el worker.

## Definición de hecho
- `planReminders` con ≥ 15 casos pasando; aislamiento entre usuarios probado.
- E2E: conceder permiso, suscribirse, enviar prueba a un endpoint simulado y comprobar la carga útil.
- Una prueba manual en Android y otra en iPhone instalada, con la app cerrada.
- `npm run typecheck && npm run lint && npm test && npm run e2e` en verde y escritorio sin cambios visuales.
