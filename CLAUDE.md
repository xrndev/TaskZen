@AGENTS.md

# Serenboard

Tablero Kanban en equipo. Web (Next.js 16, React 19, Tailwind 4) + app Android nativa (Expo / React Native) sobre el mismo servidor (PostgreSQL + Drizzle + Better Auth). Idioma del código, comentarios, commits y respuestas: **español**.

## Marca
- El producto se llama **Serenboard** (antes TaskZen). Logo y activos: `docs/brand/serenboard-marca.svg` es la fuente única; `node scripts/generar-marca.mjs` regenera todos los PNG (web, app y docs).
- **Siguen con el nombre antiguo a propósito** (renombrarlos rompe lo desplegado): `/opt/taskzen`, volúmenes/imágenes Docker, usuario y base de datos `taskzen`, el host `taskzen.duckdns.org`, el Worker `taskzen-reminders`, y la app TWA antigua en `native/android` (su clave de firma). Se cambian el día que haya dominio propio (`docs/DEPLOY.md`).

## Comandos
```bash
npx tsc --noEmit            # tipos (web)
npx eslint src tests        # lint
npx vitest run              # tests (servicios con PGlite, API, adaptadores; no necesitan Docker)
npm run db:generate         # migración nueva tras cambiar src/db/schema.ts (revisar el SQL)
DATABASE_URL=postgres://build:build@localhost:5432/build BETTER_AUTH_SECRET=build-time-only-build-time-only-0000 npx next build
```
**Antes de desplegar ejecuta siempre `next build`**: detecta errores que `tsc` y los tests no ven (por ejemplo, las server actions deben ser `export async function`, no constantes con flecha).

## Arquitectura en capas (no la rompas)
```
server actions (web)   rutas /api/v1 (app)     ← adaptadores finos: sesión + traducir errores
              \              /
               src/server/usecases/            ← validación Zod + orquestación + efectos (avisos, archivos); reciben `unknown`
                        |
               src/server/services/            ← reglas de negocio y permisos (`can()`), reciben `db`
                        |
                  PostgreSQL (Drizzle)
```
- Las reglas viven **una sola vez**. Una operación nueva = un caso de uso + una línea en `actions/*.ts` + una línea en la ruta `src/app/api/v1/...` con `endpoint()` (`src/server/api/endpoint.ts`).
- Las rutas `/api/v1` y las actions no validan ni llaman a servicios directamente.
- Los errores de negocio son `ServiceError` (`FORBIDDEN | NOT_FOUND | INVALID | CONFLICT`); un id mal formado es `NOT_FOUND` (no se distingue de "sin acceso").
- No hay RLS: toda la autorización está en servidor y cubierta por tests (`tests/services.test.ts`, `tests/api.v1.test.ts`).
- Planes: el catálogo y los límites están en `src/lib/plans.ts` (código puro, lo comparten servicios, landing y app) y se aplican en `services/billing.ts`; los demás servicios solo llaman a sus `assert...` y lanzan `ServiceError('LIMIT')` (HTTP 402). Lo no construido se rotula «Próximamente», nunca como incluido. Los errores LIMIT llevan `scope` (`user`/`team`) y la web abre `UpgradeDialog` en vez de un aviso. `/admin/planes` (solo lectura, `ADMIN_EMAILS`) y `scripts/plan.mjs` (concede, quita, `stats`; queda auditado). Personal Pro no se anuncia (`listed: false`). Detalle: `docs/PLANES.md`.
- Plantillas de tablero: catálogo puro en `src/lib/templates.ts`; `services/templates.ts` las aplica solo a tableros vacíos (`POST /api/v1/teams/:id/template`). La web las ofrece en la guía de «Primeros pasos» del tablero vacío.
- Notificaciones: `src/server/push/` (Web Push con VAPID y FCM con cuenta de servicio, repartidos por `RoutingSender`). Detalle en `docs/PUSH-FCM.md`.

## App nativa (`native/mobile`)
- Expo SDK 58 + Expo Router; **lee su `AGENTS.md`** antes de tocar APIs de Expo (cambian entre versiones). `npx tsc --noEmit` y `npx expo-doctor` desde esa carpeta.
- Comparte con la web solo código puro, importado como `@domain/...` (alias en `tsconfig.json` + `metro.config.js`): `src/types`, `src/lib/permissions.ts`, `src/lib/initials.ts`, `src/lib/reminders.ts`, `src/lib/plans.ts` (si añades otro, ponlo también en el `COPY` de `Dockerfile.android` y en su `.dockerignore`, que es una lista blanca). Esos archivos **no pueden importar `@/...` ni nada del framework** (usa rutas relativas).
- Todas las llamadas HTTP pasan por `src/lib/client.ts` (mismos nombres que los casos de uso). La sesión es la cookie de Better Auth (plugin Expo) enviada a mano en la cabecera `Cookie`.
- Diseño = web móvil: mismos 5 temas (`lib/theme.tsx`, por defecto "cyber"), fuente Geist, mismas pantallas. Si cambias algo en `src/components/mobile/*`, cambia también su equivalente nativo.
- Hermes no entiende las fechas de Postgres: usa siempre `lib/dates.ts` (`parseDate`), nunca `new Date(string)`.
- No sirve Expo Go (SDK 58 + módulos nativos): se prueba con el APK.
- **Compilar el APK en Windows falla** (rutas de más de 260 caracteres). Se hace en Docker, desde la raíz del repo:
  `docker build -f native/mobile/Dockerfile.android --output type=local,dest=native/mobile/out .` → `native/mobile/out/Serenboard.apk` (firmado con clave de depuración, solo arm64).
- Las notificaciones nativas necesitan `native/mobile/google-services.json` (Firebase) y `FCM_SERVICE_ACCOUNT_B64` en el servidor. Sin ellos la app compila, pero avisa de que no están configuradas.

## Despliegue (VPS en `/opt/taskzen`, Docker Compose + Caddy)
- La VPS no compila: se construyen las imágenes en local y se suben (ver `docs/DEPLOY.md`). Usa un script con `set -euo pipefail`: un `| tail` oculta los fallos y subiría la imagen anterior.
- Acceso por clave SSH (`~/.ssh/chollo_vps`). **No guardes contraseñas ni claves en el repositorio, en la memoria ni en el chat.**
- El APK se publica copiándolo a `/opt/taskzen/downloads/Serenboard.apk` (se sirve en `/descargas/`).
- Un Worker de Cloudflare (`workers/reminders`, cron cada 5 min) llama a `/api/internal/reminders/tick`.

## Trampas del entorno
- Con poca RAM Docker Desktop se cuelga o el sistema mata los procesos largos: cierra programas pesados, `docker desktop restart` libera memoria, y no relances compilaciones en bucle.
- En la herramienta Bash, los comandos muy largos con varios heredocs fallan: escribe los archivos con la herramienta Write y los scripts de Python en el scratchpad.
- Git en Windows avisa de LF/CRLF en cada commit; es inofensivo.
