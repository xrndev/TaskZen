---
name: mobile-readiness-audit
description: Audita si TaskZen está listo para empaquetarse como app de Android o iOS y para enviar notificaciones push, sin romper la web de móvil ni escritorio. Úsala cuando se pida "auditar la app móvil", "ver si podemos publicar en las tiendas", "estado de las notificaciones push" o antes de tocar la arquitectura móvil.
---
# Auditoría de preparación móvil y push

Produce un informe fechado, con evidencia reproducible, de qué falta para (1) enviar notificaciones y recordatorios y (2) publicar en Play Store y App Store, y qué se puede hacer **sin tocar** la web que ya funciona.

## 1. Línea base (siempre primero)
Registra el estado actual para poder demostrar que no se rompe nada:
```bash
npm run typecheck && npm run lint && npm test
npm run e2e                      # incluye e2e/mobile.spec.ts (móvil + axe)
node scripts/audit-mobile-readiness.mjs --json > docs/audits/AAAA-MM-DD.json
```
Si algo falla, **para y repórtalo**: no se audita sobre una base rota.

## 2. Interpretar la auditoría automática
`node scripts/audit-mobile-readiness.mjs` devuelve niveles:
- **BLOQUEO**: impide publicar o enviar push. Se resuelve antes de cualquier otra cosa.
- **AVISO**: conviene resolver; puede causar rechazo o fallos en dispositivo.
- **INFO**: dato para decidir.
- **OK**: cumple.

Para cada BLOQUEO y AVISO anota: qué pasa, quién lo exige (Apple, Google, el navegador, el RGPD), esfuerzo (horas/días), y qué archivos se tocan. Prioriza lo que desbloquea más cosas (por ejemplo, el dominio propio condiciona passkeys, enlaces verificados y la ficha de tienda).

## 3. Lo que el script no puede saber (completar a mano o con otros agentes)
- **Políticas vigentes de las tiendas** → agente `store-compliance` (consultar fuentes oficiales del día, nunca de memoria).
- **Elección de vía de empaquetado y límites de código** → agente `mobile-architect`.
- **Notificaciones y recordatorios** → agente `push-notifications` y skill `push-reminders-design`.
- **Comportamiento en WebView real** → agente `mobile-qa` (lista de comprobaciones en iPhone y Android; el script solo cuenta usos de APIs delicadas).

## 4. Medir el acoplamiento (cómo evitar romper lo hecho)
Responde con datos, no con opiniones:
```bash
grep -rn "from 'next/" src/server/services        # debe estar vacío: los servicios no dependen del framework
grep -rln "use server" src/server/actions | wc -l # puertas de entrada actuales
grep -rn "@capacitor" src package.json            # debe estar vacío fuera de native/
```
La regla: la lógica está en `services`; las puertas (web, API, worker, app) son capas finas encima.

## 5. Informe
Escribe `docs/audits/AAAA-MM-DD-movil.md` con:
1. Resumen en 5 líneas (qué se puede hacer ya, qué no, qué cuesta).
2. Tabla de bloqueos y avisos con esfuerzo y propietario.
3. Comparación de vías (PWA+Push, TWA, Capacitor, React Native) con coste de código, riesgo para la web y requisitos de tienda.
4. Recomendación por fases, cada una con su criterio de "hecho" y su prueba.
5. Decisiones que necesita el dueño del producto (dominio, cuentas de desarrollador, si iOS nativo es imprescindible).
6. Limitaciones: qué no se pudo verificar y cómo comprobarlo.

## 6. Ampliar el script
Añade comprobaciones en `scripts/audit-mobile-readiness.mjs` con `add(id, nivel, titulo, detalle, arreglo)`. Cada una debe ser verificable y no tener falsos positivos conocidos; si depende de un servicio externo, que sea `INFO`. Prueba el script tras cada cambio y ten cuidado con las rutas en Windows (`/` siempre).

## Criterios de calidad
- Cada afirmación sobre una tienda lleva fuente y fecha.
- Nada se da por cierto sin ejecutar el comando que lo demuestra.
- La recomendación nunca propone reescribir la UI si un empaquetado la reutiliza.
