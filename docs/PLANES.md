# Planes y límites

Serenboard tiene dos capas de plan que **se suman**:

- **Equipo** (`team_free`, `team_plus`, `team_pro`): lo paga el equipo; manda en miembros y espacio compartido.
- **Personal** (`user_free`, `user_plus`, `user_pro`): lo paga la persona y la acompaña a cualquier equipo.
- `team_pro` regala `user_plus` a todos sus miembros (se aplica el mejor entre el plan propio y el regalado).
- El espacio personal de cada cuenta no tiene plan de equipo: usa el plan **personal** de su dueña o dueño (espacio, exportación).

## Qué incluye cada plan
La fuente única es [`src/lib/plans.ts`](../src/lib/plans.ts): de ahí salen los límites que aplican los servicios **y** la landing, `/precios` y el panel de la app, así que no pueden contradecirse. Un test (`tests/billing.test.ts`) comprueba que lo no construido nunca figure como incluido.

| | Gratis | Plus | Pro |
|---|---|---|---|
| **Equipo**: miembros | 5 | 15 | sin límite |
| **Equipo**: adjuntos | 100 MB | 5 GB | 50 GB |
| **Equipo**: tamaño máximo por archivo | 10 MB | 25 MB | 50 MB |
| **Equipo**: exportar | — | CSV | CSV y JSON completo |
| **Personal**: equipos propios | 1 | 5 | sin límite |
| **Personal**: recordatorios antes del vencimiento (p. ej. 1 día y 1 hora antes = 2) | 2 | 4 | 6 |
| **Personal**: adjuntos del espacio personal | 100 MB | 2 GB | 5 GB |
| **Personal**: tamaño máximo por archivo | 10 MB | 25 MB | 50 MB |
| **Personal**: exportar mis tareas | — | CSV | CSV y JSON |

Precios previstos (orientativos, en `plans.ts`): Personal Plus 3 €/mes; Equipo Plus 5 €/mes, Pro 15 €; anual = 10 meses. **Personal Pro existe y se puede conceder a mano, pero no se anuncia** (`listed: false` en `plans.ts`): hoy solo se diferencia de Plus en cantidades, y se anunciará cuando tenga funciones propias (calendario, asistente). Para anunciarlo, quita esa línea. Lo marcado «Próximamente» en `plans.ts` (`soon`) **no existe todavía**: se muestra como planificado, nunca como incluido.

## Cómo se aplican
Los límites viven en `src/server/services/billing.ts` y los demás servicios solo llaman a sus funciones `assert...` (una sola vez, como el resto de reglas):

| Límite | Dónde se comprueba |
|---|---|
| Miembros | `assertCanAddMember` en `inviteMember` y `acceptInvite` |
| Equipos propios | `assertCanCreateTeam` en `createTeam` |
| Espacio de adjuntos | `assertStorageAvailable` en `authorizeUpload` (antes de escribir en disco) |
| Recordatorios antes del vencimiento | `assertCanSetReminderOffsets` en el caso de uso `updatePrefs` |
| Exportación | `assertCanExport` en `services/export.ts` (solo admin y product owner exportan un equipo) |
| Tamaño por archivo | `assertFileSize` en `authorizeUpload` (el tope técnico es `MAX_FILE_SIZE`; Caddy admite hasta 60 MB, ver `deploy/Caddyfile`) |

Al superar un límite se lanza `ServiceError('LIMIT', mensaje, scope)` → HTTP **402** en `/api/v1`, con `scope` = `user` o `team` (qué plan habría que mejorar). La web lo convierte en un diálogo de mejora (`UpgradeDialog`) que lleva directo al plan correcto. **Los límites solo frenan lo nuevo**: bajar de plan o caducar una prueba nunca borra ni expulsa a nadie; el equipo que supera su plan lo ve avisado en su panel, y los recordatorios que sobran dejan de enviarse (se conservan, y vuelven al mejorar).

## Pruebas gratuitas
14 días, **una sola vez por dueño** (persona o equipo), sin datos de pago, desde el panel «Tu plan» del perfil o «Plan del equipo» de los ajustes (solo administración). La fila de `subscriptions` se conserva al caducar, y por eso no se puede repetir. Al caducar, `isActive()` deja de concederla y rigen los límites gratuitos.

## Conceder un plan a mano (mientras no haya pagos)
```bash
# en la VPS
cd /opt/taskzen
docker compose run --rm migrate node scripts/plan.mjs list
docker compose run --rm migrate node scripts/plan.mjs user  alguien@correo.com user_plus 30   # 30 días; sin número = sin caducidad
docker compose run --rm migrate node scripts/plan.mjs team  <id-del-equipo> team_pro
docker compose run --rm migrate node scripts/plan.mjs quitar user alguien@correo.com
```
En local: `node --env-file=.env.local scripts/plan.mjs ...`. El id de un equipo se ve en la tabla `teams`.

## Avisos de fin de prueba
Sin correo, el canal es la propia app: un banner (`PlanBanner`) avisa cuando faltan 3 días o menos, y otra vez durante 14 días tras terminar («no se ha borrado nada»). Se puede cerrar y se recuerda en el navegador. La app nativa muestra el estado en «Tu plan».

## Medir y administrar
- **Contadores anónimos** (`plan_metrics`): cuántas veces al día se alcanza cada límite y cuántas pruebas se inician; sin identificar a nadie (declarado en `/privacidad`). `node scripts/plan.mjs stats`.
- **Registro de concesiones** (`plan_audit`): quién concedió o retiró qué plan y cuándo (`PLAN_ACTOR` o el usuario del sistema).
- **Pantalla `/admin/planes`** (solo lectura): planes y pruebas vigentes, contadores y registro. Define `ADMIN_EMAILS` en el `.env` del servidor; hay que entrar con Google, Microsoft o GitHub (con contraseña el correo no está verificado y no da acceso). Para el resto de personas devuelve un 404.
- **Plan de un equipo si se va quien lo contrató**: el plan es del equipo, no de la persona; cualquier administrador lo gestiona y el equipo siempre conserva al menos uno.

## Pagos en línea (pendiente)
No hay proveedor de pagos conectado y la web lo dice claramente. Para añadirlo:
1. Elegir proveedor (un «merchant of record» como Paddle o Lemon Squeezy se encarga del IVA).
2. Un caso de uso `applyPaymentEvent` + una ruta de webhook fina (con verificación de firma) que llame a `grantPlan(db, owner, plan, { days, provider, providerRef })`; ese es el único punto que cambia el estado de pago.
3. Botón «Contratar» en `PlanPanel` que abra el checkout del proveedor.
4. Si se publica la app en Google Play o App Store, **los pagos dentro de la app tienen reglas propias** (facturación de la tienda): revisar antes de enseñar precios ahí.
5. Actualizar `/terminos` (hoy dice que los pagos no están activados) y `/privacidad` (proveedor como destinatario).

## App nativa
Aplica los límites porque llaman a la misma API (los errores 402 llegan con mensaje), y el selector de avisos respeta el tope de cada plan. **No tiene aún pantalla de plan**: ver, probar y exportar se hace desde la web.
