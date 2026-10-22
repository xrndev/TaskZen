import { and, eq, gt, inArray, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm'
import { notificationEndpoints, notificationPrefs, reminderLog, tasks } from '@/db/schema'
import { formatRemaining, planReminders, sentKey, type PlanPrefs } from '@/lib/reminders'
import type { Db } from '@/server/db'
import type { PushPayload, PushSender } from '@/server/push/types'
import { ServiceError } from './common'

/** Antelaciones que se pueden elegir, en minutos. */
export const ALLOWED_OFFSETS = [5, 15, 30, 60, 120, 180, 360, 720, 1440, 2880] as const
export const MAX_OFFSETS = 4
export const MAX_ENDPOINTS_PER_USER = 10
/** Los avisos se buscan hasta esta distancia en el futuro (la mayor antelación es de 2 días). */
const HORIZON_MS = 3 * 24 * 60 * 60_000

/**
 * Los servicios de push reales. El servidor envía peticiones a la dirección que le da el navegador, así que sin
 * esta lista un usuario podría registrar una dirección interna y usar el servidor para atacarla (SSRF).
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function isAllowedPushEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false
    return PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

export interface Prefs {
  enabled: boolean
  due_soon: boolean
  assigned: boolean
  offsets_minutes: number[]
  quiet_start: string | null
  quiet_end: string | null
  timezone: string
}

export const DEFAULT_PREFS: Prefs = {
  enabled: false, due_soon: true, assigned: true, offsets_minutes: [1440, 60], quiet_start: null, quiet_end: null, timezone: 'Europe/Madrid',
}

const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function getPrefs(db: Db, userId: string): Promise<Prefs> {
  const [row] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.user_id, userId))
  if (!row) return { ...DEFAULT_PREFS }
  const { user_id: _u, updated_at: _t, ...prefs } = row
  void _u; void _t
  return prefs
}

export async function savePrefs(db: Db, userId: string, input: Prefs): Promise<Prefs> {
  const offsets = [...new Set(input.offsets_minutes)].sort((a, b) => b - a)
  if (offsets.some((o) => !(ALLOWED_OFFSETS as readonly number[]).includes(o))) throw new ServiceError('INVALID', 'Antelación no válida.')
  if (offsets.length > MAX_OFFSETS) throw new ServiceError('INVALID', `Elige como máximo ${MAX_OFFSETS} antelaciones.`)
  if (input.due_soon && offsets.length === 0) throw new ServiceError('INVALID', 'Elige al menos una antelación.')
  const qs = input.quiet_start || null
  const qe = input.quiet_end || null
  if ((qs === null) !== (qe === null)) throw new ServiceError('INVALID', 'Indica la hora de inicio y la de fin del silencio, o ninguna.')
  if ((qs && !HHMM.test(qs)) || (qe && !HHMM.test(qe))) throw new ServiceError('INVALID', 'Hora no válida.')
  if (!validTimezone(input.timezone)) throw new ServiceError('INVALID', 'Zona horaria no válida.')

  const values = { enabled: input.enabled, due_soon: input.due_soon, assigned: input.assigned, offsets_minutes: offsets, quiet_start: qs, quiet_end: qe, timezone: input.timezone }
  await db
    .insert(notificationPrefs)
    .values({ user_id: userId, ...values })
    .onConflictDoUpdate({ target: notificationPrefs.user_id, set: { ...values, updated_at: new Date().toISOString() } })
  return { ...values }
}

export interface EndpointInput { endpoint: string; p256dh: string; auth: string; userAgent?: string | null }

export async function saveEndpoint(db: Db, userId: string, input: EndpointInput) {
  if (!isAllowedPushEndpoint(input.endpoint)) throw new ServiceError('INVALID', 'Este navegador no ofrece un servicio de notificaciones compatible.')
  if (!input.p256dh || !input.auth || input.p256dh.length > 200 || input.auth.length > 100) throw new ServiceError('INVALID', 'Suscripción no válida.')

  const mine = await db.select({ endpoint: notificationEndpoints.endpoint }).from(notificationEndpoints).where(eq(notificationEndpoints.user_id, userId))
  if (!mine.some((m) => m.endpoint === input.endpoint) && mine.length >= MAX_ENDPOINTS_PER_USER) {
    throw new ServiceError('CONFLICT', 'Has alcanzado el máximo de dispositivos. Quita alguno antes de añadir otro.')
  }
  // Una suscripción pertenece al navegador: si otra cuenta la tenía, pasa a quien inició sesión ahora.
  await db
    .insert(notificationEndpoints)
    .values({ user_id: userId, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, user_agent: input.userAgent?.slice(0, 300) ?? null })
    .onConflictDoUpdate({
      target: notificationEndpoints.endpoint,
      set: { user_id: userId, p256dh: input.p256dh, auth: input.auth, user_agent: input.userAgent?.slice(0, 300) ?? null, disabled_at: null },
    })
}

export async function removeEndpoint(db: Db, userId: string, endpoint: string) {
  await db.delete(notificationEndpoints).where(and(eq(notificationEndpoints.user_id, userId), eq(notificationEndpoints.endpoint, endpoint)))
}

export async function countActiveEndpoints(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ id: notificationEndpoints.id })
    .from(notificationEndpoints)
    .where(and(eq(notificationEndpoints.user_id, userId), isNull(notificationEndpoints.disabled_at)))
  return rows.length
}

type ActiveEndpoint = { id: string; endpoint: string; p256dh: string; auth: string }

async function activeEndpointsFor(db: Db, userIds: string[]): Promise<Map<string, ActiveEndpoint[]>> {
  const map = new Map<string, ActiveEndpoint[]>()
  if (userIds.length === 0) return map
  const rows = await db
    .select({ id: notificationEndpoints.id, user_id: notificationEndpoints.user_id, endpoint: notificationEndpoints.endpoint, p256dh: notificationEndpoints.p256dh, auth: notificationEndpoints.auth })
    .from(notificationEndpoints)
    .where(and(inArray(notificationEndpoints.user_id, userIds), isNull(notificationEndpoints.disabled_at)))
  for (const r of rows) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r])
  return map
}

/** Envía a todos los dispositivos de una persona y deja la base de datos al día (último envío correcto, bajas). */
async function deliver(db: Db, sender: PushSender, endpoints: ActiveEndpoint[], payload: PushPayload) {
  const results = await Promise.all(endpoints.map(async (e) => ({ e, r: await sender.send(e, payload) })))
  const okIds = results.filter((x) => x.r.ok).map((x) => x.e.id)
  const goneIds = results.filter((x) => !x.r.ok && (x.r as { gone: boolean }).gone).map((x) => x.e.id)
  if (okIds.length) await db.update(notificationEndpoints).set({ last_ok_at: new Date().toISOString() }).where(inArray(notificationEndpoints.id, okIds))
  if (goneIds.length) await db.update(notificationEndpoints).set({ disabled_at: new Date().toISOString() }).where(inArray(notificationEndpoints.id, goneIds))
  return { ok: okIds.length, gone: goneIds.length, failed: results.length - okIds.length - goneIds.length }
}

/** Fecha límite como ISO en UTC (la cadena que devuelve el controlador varía según el motor). */
const isoUtc = (col: typeof tasks.due_date | typeof reminderLog.due_at) =>
  sql<string>`to_char(${col} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

export interface TickResult { planned: number; sent: number; skipped: number; retried: number; disabledEndpoints: number }

/**
 * Un "tick": lo que se ejecuta cada minuto. Busca los avisos de vencimiento que tocan ahora y los envía.
 * Es idempotente: cada aviso se reclama en `reminder_log` antes de enviarse, así que dos ticks simultáneos
 * (o un reintento del Worker) no pueden duplicarlo.
 */
export async function runTick(db: Db, sender: PushSender, now: Date = new Date()): Promise<TickResult> {
  const result: TickResult = { planned: 0, sent: 0, skipped: 0, retried: 0, disabledEndpoints: 0 }
  const nowIso = now.toISOString()
  const horizon = new Date(now.getTime() + HORIZON_MS).toISOString()

  const rows = await db
    .select({
      id: tasks.id, title: tasks.title, assigned_to: tasks.assigned_to, due: isoUtc(tasks.due_date),
      enabled: notificationPrefs.enabled, due_soon: notificationPrefs.due_soon, offsets: notificationPrefs.offsets_minutes,
      quiet_start: notificationPrefs.quiet_start, quiet_end: notificationPrefs.quiet_end, timezone: notificationPrefs.timezone,
    })
    .from(tasks)
    .innerJoin(notificationPrefs, eq(notificationPrefs.user_id, tasks.assigned_to))
    .where(and(ne(tasks.status, 'completed'), isNotNull(tasks.due_date), gt(tasks.due_date, nowIso), lte(tasks.due_date, horizon), eq(notificationPrefs.enabled, true), eq(notificationPrefs.due_soon, true)))
  if (rows.length === 0) return result

  const userIds = [...new Set(rows.map((r) => r.assigned_to!))]
  const endpoints = await activeEndpointsFor(db, userIds)
  // Sin ningún dispositivo no se reclama nada: cuando la persona active las notificaciones, aún le llegará.
  const candidates = rows.filter((r) => (endpoints.get(r.assigned_to!)?.length ?? 0) > 0)
  if (candidates.length === 0) return result

  const prefs = new Map<string, PlanPrefs>()
  for (const r of candidates) {
    prefs.set(r.assigned_to!, { enabled: r.enabled, due_soon: r.due_soon, offsets_minutes: r.offsets, quiet_start: r.quiet_start, quiet_end: r.quiet_end, timezone: r.timezone })
  }

  const log = await db
    .select({ task_id: reminderLog.task_id, user_id: reminderLog.user_id, offset_minutes: reminderLog.offset_minutes, due: isoUtc(reminderLog.due_at) })
    .from(reminderLog)
    .where(inArray(reminderLog.task_id, candidates.map((c) => c.id)))
  const sent = new Set(log.map((l) => sentKey(l.task_id, l.user_id, l.offset_minutes, l.due)))

  const planned = planReminders({
    tasks: candidates.map((c) => ({ id: c.id, title: c.title, due_at: c.due, assigned_to: c.assigned_to! })),
    prefs,
    sent,
    now: now.getTime(),
  })
  result.planned = planned.length

  for (const p of planned) {
    // Reclamar primero: si otra ejecución ya lo hizo, no se inserta nada y se omite.
    const claimed = await db
      .insert(reminderLog)
      .values({ task_id: p.taskId, user_id: p.userId, offset_minutes: p.offsetMinutes, due_at: p.dueAt })
      .onConflictDoNothing()
      .returning({ task_id: reminderLog.task_id })
    if (claimed.length === 0) { result.skipped++; continue }

    const out = await deliver(db, sender, endpoints.get(p.userId) ?? [], {
      title: 'Vence pronto',
      body: `${p.title} · vence en ${formatRemaining(p.remainingMinutes)}`,
      url: `/board?task=${p.taskId}`,
      tag: `due-${p.taskId}`,
    })
    result.disabledEndpoints += out.gone
    if (out.ok > 0) {
      result.sent++
    } else if (out.failed > 0) {
      // Fallo transitorio (red, 429, 5xx) en todos los dispositivos: se suelta el aviso para reintentarlo en el siguiente tick.
      await db.delete(reminderLog).where(and(eq(reminderLog.task_id, p.taskId), eq(reminderLog.user_id, p.userId), eq(reminderLog.offset_minutes, p.offsetMinutes), eq(reminderLog.due_at, p.dueAt)))
      result.retried++
    }
  }
  return result
}

/** Aviso inmediato cuando alguien te asigna una tarea. Nunca avisa a quien se la asigna a sí mismo. */
export async function notifyTaskAssigned(db: Db, sender: PushSender, input: { actorId: string; taskId: string }): Promise<{ sent: number }> {
  const [task] = await db.select({ id: tasks.id, title: tasks.title, assigned_to: tasks.assigned_to }).from(tasks).where(eq(tasks.id, input.taskId))
  const target = task?.assigned_to
  if (!task || !target || target === input.actorId) return { sent: 0 }
  const prefs = await getPrefs(db, target)
  if (!prefs.enabled || !prefs.assigned) return { sent: 0 }
  const endpoints = (await activeEndpointsFor(db, [target])).get(target) ?? []
  if (endpoints.length === 0) return { sent: 0 }
  const out = await deliver(db, sender, endpoints, { title: 'Te han asignado una tarea', body: task.title, url: `/board?task=${task.id}`, tag: `assigned-${task.id}` })
  return { sent: out.ok }
}

/** Prueba desde los ajustes: envía a los dispositivos de quien la pide. */
export async function sendTestNotification(db: Db, sender: PushSender, userId: string): Promise<{ sent: number; failed: number }> {
  const endpoints = (await activeEndpointsFor(db, [userId])).get(userId) ?? []
  if (endpoints.length === 0) throw new ServiceError('NOT_FOUND', 'No hay ningún dispositivo con las notificaciones activadas.')
  const out = await deliver(db, sender, endpoints, { title: 'TaskZen', body: 'Las notificaciones funcionan en este dispositivo.', url: '/board', tag: 'test' })
  return { sent: out.ok, failed: out.failed + out.gone }
}
