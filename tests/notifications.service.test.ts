// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '@/server/db'
import type { PushPayload, PushResult, PushSender, PushTarget } from '@/server/push/types'
import * as svc from '@/server/services/notifications'
import * as tasksSvc from '@/server/services/tasks'
import * as teamsSvc from '@/server/services/teams'
import { createTestDb, createUser } from './helpers/testdb'

const MIN = 60_000
const NOW = new Date('2026-10-21T10:00:00Z')
const FCM = (n: number | string) => `https://fcm.googleapis.com/fcm/send/${n}`
const KEYS = { p256dh: 'BP'.padEnd(87, 'x'), auth: 'a'.repeat(22) }

class FakeSender implements PushSender {
  calls: { target: PushTarget; payload: PushPayload }[] = []
  /** Resultado por dirección; por defecto, correcto. */
  results = new Map<string, PushResult>()
  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    this.calls.push({ target, payload })
    return this.results.get(target.endpoint) ?? { ok: true }
  }
}

let db: Db
let sender: FakeSender
let alice: Awaited<ReturnType<typeof createUser>>
let bob: Awaited<ReturnType<typeof createUser>>
let team: { id: string }

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ name: 'ServiceError', code })
}

const prefs = (over: Partial<svc.Prefs> = {}): svc.Prefs => ({ ...svc.DEFAULT_PREFS, enabled: true, timezone: 'UTC', ...over })
const dueIn = (min: number) => new Date(NOW.getTime() + min * MIN).toISOString()

/** Tarea asignada a Alice que vence dentro de `min` minutos. */
async function taskDueIn(min: number, over: { assigned_to?: string | null; title?: string } = {}) {
  return tasksSvc.createTask(db, bob.id, team.id, {
    title: over.title ?? 'Revisar permisos',
    due_date: dueIn(min),
    assigned_to: over.assigned_to === undefined ? alice.id : over.assigned_to,
  })
}

beforeEach(async () => {
  // Base nueva por prueba: así no se arrastran avisos ya reclamados.
  db = await createTestDb()
  sender = new FakeSender()
  alice = await createUser(db, 'Alice')
  bob = await createUser(db, 'Bob')
  team = await teamsSvc.createTeam(db, bob.id, 'Equipo')
  await teamsSvc.inviteMember(db, bob.id, team.id, 'alice@test.dev', 'member')
})

describe('direcciones de push permitidas (defensa contra SSRF)', () => {
  it('acepta los servicios de push reales', () => {
    for (const u of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) expect(svc.isAllowedPushEndpoint(u), u).toBe(true)
  })

  it('rechaza http, direcciones internas, dominios engañosos y datos de acceso', () => {
    for (const u of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://localhost/x', 'https://127.0.0.1/x', 'https://169.254.169.254/latest/meta-data',
      'https://postgres:5432/', 'https://app:3000/api/internal/reminders/tick',
      'https://fcm.googleapis.com.evil.example/x', 'https://evilfcm.googleapis.com.example.org/x',
      'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x',
      'no-es-una-url', '',
    ]) expect(svc.isAllowedPushEndpoint(u), u).toBe(false)
  })
})

describe('dispositivos', () => {
  it('guarda un dispositivo y lo cuenta; una dirección no válida se rechaza', async () => {
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM(1), ...KEYS })
    expect(await svc.countActiveEndpoints(db, alice.id)).toBe(1)
    await expectCode(svc.saveEndpoint(db, alice.id, { endpoint: 'https://localhost/x', ...KEYS }), 'INVALID')
    await expectCode(svc.saveEndpoint(db, alice.id, { endpoint: FCM(2), p256dh: '', auth: '' }), 'INVALID')
  })

  it('registrar dos veces el mismo no lo duplica y reactiva uno dado de baja', async () => {
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM(1), ...KEYS })
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM(1), ...KEYS })
    expect(await svc.countActiveEndpoints(db, alice.id)).toBe(1)
  })

  it('el navegador compartido pasa a la cuenta que inició sesión', async () => {
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM(1), ...KEYS })
    await svc.saveEndpoint(db, bob.id, { endpoint: FCM(1), ...KEYS })
    expect(await svc.countActiveEndpoints(db, alice.id)).toBe(0)
    expect(await svc.countActiveEndpoints(db, bob.id)).toBe(1)
  })

  it('hay un máximo de dispositivos por persona', async () => {
    for (let i = 0; i < svc.MAX_ENDPOINTS_PER_USER; i++) await svc.saveEndpoint(db, alice.id, { endpoint: FCM(i), ...KEYS })
    await expectCode(svc.saveEndpoint(db, alice.id, { endpoint: FCM('extra'), ...KEYS }), 'CONFLICT')
  })

  it('nadie puede quitar el dispositivo de otra persona', async () => {
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM(1), ...KEYS })
    await svc.removeEndpoint(db, bob.id, FCM(1))
    expect(await svc.countActiveEndpoints(db, alice.id)).toBe(1)
    await svc.removeEndpoint(db, alice.id, FCM(1))
    expect(await svc.countActiveEndpoints(db, alice.id)).toBe(0)
  })
})

describe('preferencias', () => {
  it('sin guardar nada, se devuelven los valores por defecto y las notificaciones están apagadas', async () => {
    expect(await svc.getPrefs(db, alice.id)).toEqual(svc.DEFAULT_PREFS)
    expect(svc.DEFAULT_PREFS.enabled).toBe(false)
  })

  it('guarda, ordena las antelaciones y se puede volver a leer', async () => {
    await svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [60, 1440, 60], quiet_start: '22:00', quiet_end: '08:00', timezone: 'Europe/Madrid' }))
    expect(await svc.getPrefs(db, alice.id)).toMatchObject({ enabled: true, offsets_minutes: [1440, 60], quiet_start: '22:00', quiet_end: '08:00', timezone: 'Europe/Madrid' })
  })

  it('valida antelaciones, horas y zona horaria', async () => {
    await expectCode(svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [7] })), 'INVALID')
    await expectCode(svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [5, 15, 30, 60, 120] })), 'INVALID')
    await expectCode(svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [] })), 'INVALID')
    await expectCode(svc.savePrefs(db, alice.id, prefs({ quiet_start: '22:00', quiet_end: null })), 'INVALID')
    await expectCode(svc.savePrefs(db, alice.id, prefs({ quiet_start: '25:00', quiet_end: '08:00' })), 'INVALID')
    await expectCode(svc.savePrefs(db, alice.id, prefs({ timezone: 'Mars/Olympus' })), 'INVALID')
  })

  it('las preferencias de una persona no afectan a las de otra', async () => {
    await svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [30] }))
    expect((await svc.getPrefs(db, bob.id)).offsets_minutes).toEqual([1440, 60])
  })
})

describe('runTick: avisos de vencimiento', () => {
  async function ready(over: Partial<svc.Prefs> = {}) {
    await svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [60], ...over }))
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM('alice'), ...KEYS })
  }

  it('envía el aviso cuando toca, con un texto mínimo y el enlace a la tarea', async () => {
    await ready()
    const t = await taskDueIn(59, { title: 'Revisar permisos' })
    const r = await svc.runTick(db, sender, NOW)
    expect(r).toMatchObject({ planned: 1, sent: 1, retried: 0 })
    expect(sender.calls).toHaveLength(1)
    expect(sender.calls[0].target.endpoint).toBe(FCM('alice'))
    expect(sender.calls[0].payload).toEqual({ title: 'Vence pronto', body: 'Revisar permisos · vence en 59 min', url: `/board?task=${t.id}`, tag: `due-${t.id}` })
  })

  it('es idempotente: un segundo tick no repite el aviso', async () => {
    await ready()
    await taskDueIn(59)
    await svc.runTick(db, sender, NOW)
    const again = await svc.runTick(db, sender, new Date(NOW.getTime() + MIN))
    expect(again.sent).toBe(0)
    expect(sender.calls).toHaveLength(1)
  })

  it('dos ticks simultáneos no duplican el aviso', async () => {
    await ready()
    await taskDueIn(59)
    const [a, b] = await Promise.all([svc.runTick(db, sender, NOW), svc.runTick(db, sender, NOW)])
    expect(a.sent + b.sent).toBe(1)
    expect(sender.calls).toHaveLength(1)
  })

  it('no avisa antes de tiempo ni de tareas muy lejanas', async () => {
    await ready()
    await taskDueIn(120)
    await taskDueIn(30 * 24 * 60)
    expect((await svc.runTick(db, sender, NOW)).planned).toBe(0)
  })

  it('no avisa de tareas completadas, sin responsable o de otra persona', async () => {
    await ready()
    const done = await taskDueIn(59)
    await tasksSvc.updateTask(db, bob.id, done.id, {})
    await tasksSvc.moveTask(db, bob.id, done.id, { status: 'completed' })
    await taskDueIn(59, { assigned_to: null })
    await taskDueIn(59, { assigned_to: bob.id })
    expect((await svc.runTick(db, sender, NOW)).sent).toBe(0)
  })

  it('no avisa si las notificaciones están desactivadas o los avisos de vencimiento apagados', async () => {
    await ready({ enabled: false })
    await taskDueIn(59)
    expect((await svc.runTick(db, sender, NOW)).planned).toBe(0)
    await svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [60], due_soon: false }))
    expect((await svc.runTick(db, sender, NOW)).planned).toBe(0)
  })

  it('sin dispositivos no reclama nada: al activarlos después, el aviso aún llega', async () => {
    await svc.savePrefs(db, alice.id, prefs({ offsets_minutes: [60] }))
    await taskDueIn(59)
    expect((await svc.runTick(db, sender, NOW)).sent).toBe(0)
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM('alice'), ...KEYS })
    expect((await svc.runTick(db, sender, new Date(NOW.getTime() + 2 * MIN))).sent).toBe(1)
  })

  it('un fallo transitorio libera el aviso y se reintenta en el siguiente tick', async () => {
    await ready()
    await taskDueIn(59)
    sender.results.set(FCM('alice'), { ok: false, gone: false, status: 503 })
    const first = await svc.runTick(db, sender, NOW)
    expect(first).toMatchObject({ sent: 0, retried: 1 })
    sender.results.clear()
    const second = await svc.runTick(db, sender, new Date(NOW.getTime() + MIN))
    expect(second.sent).toBe(1)
  })

  it('un dispositivo dado de baja (410) se desactiva y no se reintenta', async () => {
    await ready()
    await taskDueIn(59)
    sender.results.set(FCM('alice'), { ok: false, gone: true, status: 410 })
    const r = await svc.runTick(db, sender, NOW)
    expect(r).toMatchObject({ sent: 0, retried: 0, disabledEndpoints: 1 })
    expect(await svc.countActiveEndpoints(db, alice.id)).toBe(0)
    expect((await svc.runTick(db, sender, new Date(NOW.getTime() + MIN))).planned).toBe(0)
  })

  it('con varios dispositivos, si uno funciona cuenta como enviado y el caído se da de baja', async () => {
    await ready()
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM('movil'), ...KEYS })
    await taskDueIn(59)
    sender.results.set(FCM('alice'), { ok: false, gone: true, status: 404 })
    const r = await svc.runTick(db, sender, NOW)
    expect(r).toMatchObject({ sent: 1, disabledEndpoints: 1 })
    expect(await svc.countActiveEndpoints(db, alice.id)).toBe(1)
  })

  it('si la fecha límite cambia, avisa de nuevo', async () => {
    await ready()
    const t = await taskDueIn(59)
    await svc.runTick(db, sender, NOW)
    await tasksSvc.updateTask(db, bob.id, t.id, { due_date: dueIn(50) })
    expect((await svc.runTick(db, sender, new Date(NOW.getTime() + MIN))).sent).toBe(1)
    expect(sender.calls).toHaveLength(2)
  })

  it('con varias antelaciones, cada una se avisa una sola vez en su momento', async () => {
    await ready({ offsets_minutes: [1440, 60] })
    await taskDueIn(1439)
    expect((await svc.runTick(db, sender, NOW)).sent).toBe(1)
    // 23 h después queda 1 h menos 1 min: toca el aviso de 1 hora.
    const later = new Date(NOW.getTime() + (1439 - 59) * MIN)
    expect((await svc.runTick(db, sender, later)).sent).toBe(1)
    expect((await svc.runTick(db, sender, new Date(later.getTime() + MIN))).sent).toBe(0)
  })

  it('respeta las horas de silencio', async () => {
    await ready({ quiet_start: '09:00', quiet_end: '11:00' })
    await taskDueIn(59)
    expect((await svc.runTick(db, sender, NOW)).sent).toBe(0) // 10:00 UTC está en silencio
  })
})

describe('notifyTaskAssigned', () => {
  async function enable(userId: string, over: Partial<svc.Prefs> = {}) {
    await svc.savePrefs(db, userId, prefs(over))
    await svc.saveEndpoint(db, userId, { endpoint: FCM(userId), ...KEYS })
  }

  it('avisa al responsable cuando otra persona le asigna una tarea', async () => {
    await enable(alice.id)
    const t = await taskDueIn(500)
    const r = await svc.notifyTaskAssigned(db, sender, { actorId: bob.id, taskId: t.id })
    expect(r.sent).toBe(1)
    expect(sender.calls[0].payload).toMatchObject({ title: 'Te han asignado una tarea', body: 'Revisar permisos', url: `/board?task=${t.id}` })
  })

  it('no avisa a quien se asigna la tarea a sí mismo', async () => {
    await enable(alice.id)
    const t = await taskDueIn(500)
    expect((await svc.notifyTaskAssigned(db, sender, { actorId: alice.id, taskId: t.id })).sent).toBe(0)
  })

  it('respeta que esté apagado el aviso de asignación o todas las notificaciones', async () => {
    const t = await taskDueIn(500)
    await enable(alice.id, { assigned: false })
    expect((await svc.notifyTaskAssigned(db, sender, { actorId: bob.id, taskId: t.id })).sent).toBe(0)
    await svc.savePrefs(db, alice.id, prefs({ enabled: false }))
    expect((await svc.notifyTaskAssigned(db, sender, { actorId: bob.id, taskId: t.id })).sent).toBe(0)
    expect(sender.calls).toHaveLength(0)
  })

  it('una tarea sin responsable o inexistente no avisa a nadie', async () => {
    const t = await taskDueIn(500, { assigned_to: null })
    expect((await svc.notifyTaskAssigned(db, sender, { actorId: bob.id, taskId: t.id })).sent).toBe(0)
    expect((await svc.notifyTaskAssigned(db, sender, { actorId: bob.id, taskId: '00000000-0000-4000-8000-000000000000' })).sent).toBe(0)
  })
})

describe('sendTestNotification', () => {
  it('envía a los dispositivos de quien la pide y avisa si no tiene ninguno', async () => {
    await expectCode(svc.sendTestNotification(db, sender, alice.id), 'NOT_FOUND')
    await svc.saveEndpoint(db, alice.id, { endpoint: FCM('alice'), ...KEYS })
    expect(await svc.sendTestNotification(db, sender, alice.id)).toEqual({ sent: 1, failed: 0 })
    // No toca los dispositivos de otra persona.
    expect(sender.calls.every((c) => c.target.endpoint === FCM('alice'))).toBe(true)
  })
})
