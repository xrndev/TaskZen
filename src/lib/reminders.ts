/**
 * Motor de recordatorios: decide, sin tocar red ni base de datos, qué avisos toca enviar ahora.
 * Es una función pura (recibe el reloj) para poder probar ventanas, horas de silencio y zonas horarias.
 */

export interface PlanTask {
  id: string
  title: string
  /** Fecha límite (cualquier cadena que Date.parse entienda). */
  due_at: string
  assigned_to: string
}

export interface PlanPrefs {
  enabled: boolean
  due_soon: boolean
  /** Antelaciones en minutos, por ejemplo [1440, 60]. */
  offsets_minutes: number[]
  /** 'HH:MM' en la zona horaria de la persona. Ambos nulos = sin horas de silencio. */
  quiet_start: string | null
  quiet_end: string | null
  timezone: string
}

export interface PlannedReminder {
  taskId: string
  userId: string
  offsetMinutes: number
  dueAt: string
  title: string
  remainingMinutes: number
}

/**
 * Un aviso solo se envía si el tick llega con retraso menor que esto. Evita el falso "vence en 1 día"
 * cuando una tarea se crea con la fecha ya muy cerca, o tras una caída larga del servidor.
 */
export const GRACE_MS = 15 * 60_000

export const sentKey = (taskId: string, userId: string, offsetMinutes: number, dueAt: string | number) =>
  `${taskId}|${userId}|${offsetMinutes}|${typeof dueAt === 'number' ? dueAt : Date.parse(dueAt)}`

const MIN = 60_000

/** Minutos desde la medianoche local. Con una zona horaria inválida usa UTC. */
export function localMinutes(ms: number, timezone: string): number {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ms)
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ms)
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return get('hour') * 60 + get('minute')
}

function parseHHMM(v: string | null): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v ?? '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** ¿Cae `ms` dentro de las horas de silencio? Admite tramos que cruzan la medianoche (22:00 a 08:00). */
export function inQuietHours(ms: number, prefs: Pick<PlanPrefs, 'quiet_start' | 'quiet_end' | 'timezone'>): boolean {
  const start = parseHHMM(prefs.quiet_start)
  const end = parseHHMM(prefs.quiet_end)
  if (start === null || end === null || start === end) return false
  const now = localMinutes(ms, prefs.timezone)
  return start < end ? now >= start && now < end : now >= start || now < end
}

/** "45 min", "3 h", "1 h 30 min", "2 días". */
export function formatRemaining(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 1) return 'menos de 1 min'
  if (m < 60) return `${m} min`
  if (m < 24 * 60) {
    const h = Math.floor(m / 60)
    const r = m % 60
    return r ? `${h} h ${r} min` : `${h} h`
  }
  const d = Math.floor(m / (24 * 60))
  return d === 1 ? '1 día' : `${d} días`
}

export function planReminders(input: {
  tasks: PlanTask[]
  prefs: Map<string, PlanPrefs>
  /** Claves de avisos ya enviados (ver `sentKey`). */
  sent: Set<string>
  now: number
}): PlannedReminder[] {
  const out: PlannedReminder[] = []
  for (const task of input.tasks) {
    const prefs = input.prefs.get(task.assigned_to)
    if (!prefs || !prefs.enabled || !prefs.due_soon) continue
    const due = Date.parse(task.due_at)
    if (!Number.isFinite(due) || input.now >= due) continue // sin fecha válida o ya vencida: no es "pronto"
    if (inQuietHours(input.now, prefs)) continue

    for (const offset of new Set(prefs.offsets_minutes)) {
      if (!Number.isFinite(offset) || offset <= 0) continue
      const fireAt = due - offset * MIN
      if (input.now < fireAt) continue
      const late = input.now - fireAt
      // Un aviso retrasado solo se admite si lo retuvo el horario de silencio y ya ha terminado.
      if (late > GRACE_MS && !inQuietHours(fireAt, prefs)) continue
      if (input.sent.has(sentKey(task.id, task.assigned_to, offset, due))) continue
      out.push({
        taskId: task.id,
        userId: task.assigned_to,
        offsetMinutes: offset,
        dueAt: task.due_at,
        title: task.title,
        remainingMinutes: Math.round((due - input.now) / MIN),
      })
    }
  }
  return out
}
