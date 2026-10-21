# TaskZen v2: plan

Decisiones: pila propia autoalojada, sin Supabase. Se empezó de cero (sin migrar datos).

## Stack
| Capa | Elección |
|---|---|
| App | Next.js 16 (App Router), React 19, Tailwind 4, dnd-kit |
| Datos | PostgreSQL 16 + Drizzle ORM (migraciones versionadas) |
| Auth | Better Auth: Google, Microsoft, GitHub, passkeys y contraseña. Sin correo; registro solo por invitación |
| Validación | Zod en todas las server actions |
| Tiempo real | SSE + LISTEN/NOTIFY de Postgres |
| Adjuntos | Disco de la VPS (volumen Docker), servidos con comprobación de permiso |
| Tests | Vitest (PGlite) + Playwright |
| Despliegue | Docker Compose: app + postgres + caddy, en la VPS |

Autorización: no hay RLS. Cada acción pasa por `can(user, action, resource)` en servidor.

## Estado
- [x] **Fase 0 · Base:** agentes, CI, Vitest, `.env.example`, README.
- [x] **Fase 1 · Datos y auth:** esquema Drizzle, Better Auth, `can()`, servicios con tests de aislamiento entre equipos.
- [x] **Fase 2 · App:** capa de datos en servidor, posición de tareas persistente, avisos en lugar de `alert()`, tiempo real por SSE, subidas validadas por firma real del archivo.
- [x] **Fase 3 · Producción:** Docker + Caddy + HTTPS en la VPS, copias diarias con cron.
- [x] **Fase 4 · Funciones nuevas** (parte 1): invitaciones por enlace (caducan a los 7 días, revocables, nunca dan admin), avatares por iniciales, vistas de lista y calendario, atajos de teclado (`N` nueva tarea · `/` buscar · `1` `2` `3` vistas), aviso de vencimientos próximos dentro de la app, PWA instalable.
- [ ] **Fase 4 · parte 2:** recordatorios por correo (necesita SMTP), búsqueda en servidor, refactor de `KanbanBoard.tsx`.

## Pendiente
**Infraestructura**
- Dominio propio (hoy `212-227-98-222.sslip.io`).
- Copias fuera de la VPS (Cloudflare R2 con rclone).
- Endurecer SSH (clave, sin contraseña, sin root) y rotar la clave de root.
- Credenciales OAuth de Google, Microsoft y GitHub (guía en [AUTH.md](AUTH.md)).
- Sin correo no hay "olvidé mi clave": se entra con proveedor o passkey. Pendiente: restablecimiento por un administrador.

**Producto**
- Recordatorios por correo de fechas límite (hoy hay un aviso dentro de la app: la campana).
- Búsqueda en servidor (hoy filtra en el cliente) y service worker para uso sin conexión.
- Partir `KanbanBoard.tsx` (~830 líneas) y `TaskDetailPanel.tsx` en componentes más pequeños y adoptar TanStack Query.
- Subidas y borrados huérfanos: limpiar archivos de avatar/portada reemplazados.
