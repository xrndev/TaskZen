// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatRemaining, GRACE_MS, inQuietHours, localMinutes, planReminders, sentKey, type PlanPrefs, type PlanTask } from '@/lib/reminders'

const H = 3_600_000
const MIN = 60_000
const NOW = Date.parse('2026-10-21T10:00:00Z')

const prefs = (over: Partial<PlanPrefs> = {}): PlanPrefs => ({
  enabled: true, due_soon: true, offsets_minutes: [1440, 60], quiet_start: null, quiet_end: null, timezone: 'UTC', ...over,
})
const task = (dueInMs: number, over: Partial<PlanTask> = {}): PlanTask => ({
  id: 't1', title: 'Revisar permisos', due_at: new Date(NOW + dueInMs).toISOString(), assigned_to: 'u1', ...over,
})
const plan = (tasks: PlanTask[], p: PlanPrefs = prefs(), sent = new Set<string>(), now = NOW) =>
  planReminders({ tasks, prefs: new Map([['u1', p]]), sent, now })

describe('planReminders: cuándo toca avisar', () => {
  it('avisa cuando se abre la ventana de la antelación', () => {
    // vence en 59 min: ya pasó el punto de "1 h antes" hace 1 min
    const r = plan([task(59 * MIN)])
    expect(r.map((x) => x.offsetMinutes)).toEqual([60])
    expect(r[0]).toMatchObject({ taskId: 't1', userId: 'u1', title: 'Revisar permisos', remainingMinutes: 59 })
  })

  it('no avisa antes de que llegue la hora de la antelación', () => {
    expect(plan([task(61 * MIN)])).toEqual([])
    expect(plan([task(3 * 24 * H)])).toEqual([])
  })

  it('con varias antelaciones, avisa de cada una en su momento', () => {
    expect(plan([task(1439 * MIN)]).map((x) => x.offsetMinutes)).toEqual([1440])
    expect(plan([task(55 * MIN)]).map((x) => x.offsetMinutes)).toEqual([60])
    // Si faltan 30 min, el aviso de 1 h llegaría 30 min tarde: se descarta en vez de mentir.
    expect(plan([task(30 * MIN)])).toEqual([])
  })

  it('no repite un aviso ya enviado', () => {
    const sent = new Set([sentKey('t1', 'u1', 60, NOW + 59 * MIN)])
    expect(plan([task(59 * MIN)], prefs(), sent)).toEqual([])
  })

  it('si la fecha límite cambia, vuelve a avisar', () => {
    const sentAntes = new Set([sentKey('t1', 'u1', 60, NOW + 50 * MIN)])
    expect(plan([task(59 * MIN)], prefs(), sentAntes)).toHaveLength(1)
  })

  it('no avisa de tareas ya vencidas ni sin fecha válida', () => {
    expect(plan([task(-5 * MIN)])).toEqual([])
    expect(plan([task(0)])).toEqual([])
    expect(plan([task(59 * MIN, { due_at: 'no-es-una-fecha' })])).toEqual([])
  })

  it('un aviso retrasado más de la gracia se descarta (no dice "vence en 1 día" cuando queda 1 h)', () => {
    // Tarea creada con la fecha a 2 h: el punto de "1 día antes" quedó atrás hace mucho.
    expect(plan([task(2 * H)]).map((x) => x.offsetMinutes)).toEqual([])
    // Tick tardío dentro de la gracia: sí se envía.
    expect(plan([task(60 * MIN - GRACE_MS + MIN)]).map((x) => x.offsetMinutes)).toEqual([60])
    expect(plan([task(60 * MIN - GRACE_MS - MIN)]).map((x) => x.offsetMinutes)).toEqual([])
  })

  it('respeta las preferencias: desactivado, sin avisos de vencimiento o persona sin ajustes', () => {
    expect(plan([task(59 * MIN)], prefs({ enabled: false }))).toEqual([])
    expect(plan([task(59 * MIN)], prefs({ due_soon: false }))).toEqual([])
    expect(planReminders({ tasks: [task(59 * MIN, { assigned_to: 'otro' })], prefs: new Map([['u1', prefs()]]), sent: new Set(), now: NOW })).toEqual([])
  })

  it('ignora antelaciones inválidas y repetidas', () => {
    const r = plan([task(59 * MIN)], prefs({ offsets_minutes: [60, 60, 0, -5, Number.NaN] }))
    expect(r.map((x) => x.offsetMinutes)).toEqual([60])
  })

  it('avisa a cada persona según sus propios ajustes', () => {
    const r = planReminders({
      tasks: [task(59 * MIN, { id: 'a', assigned_to: 'u1' }), task(59 * MIN, { id: 'b', assigned_to: 'u2' })],
      prefs: new Map([['u1', prefs({ offsets_minutes: [60] })], ['u2', prefs({ offsets_minutes: [10] })]]),
      sent: new Set(),
      now: NOW,
    })
    expect(r.map((x) => `${x.taskId}:${x.userId}:${x.offsetMinutes}`)).toEqual(['a:u1:60'])
  })
})

describe('horas de silencio y zonas horarias', () => {
  const quiet = { quiet_start: '22:00', quiet_end: '08:00' }

  it('calcula la hora local con la zona de la persona', () => {
    expect(localMinutes(Date.parse('2026-10-21T10:00:00Z'), 'UTC')).toBe(10 * 60)
    expect(localMinutes(Date.parse('2026-10-21T10:00:00Z'), 'Europe/Madrid')).toBe(12 * 60) // CEST (UTC+2)
    expect(localMinutes(Date.parse('2026-12-21T10:00:00Z'), 'Europe/Madrid')).toBe(11 * 60) // CET (UTC+1)
    expect(localMinutes(Date.parse('2026-10-21T10:00:00Z'), 'Mars/Olympus')).toBe(10 * 60) // inválida: UTC
  })

  it('detecta el tramo que cruza la medianoche', () => {
    const p = { ...quiet, timezone: 'UTC' }
    for (const [iso, esperado] of [['23:30', true], ['03:00', true], ['07:59', true], ['08:00', false], ['12:00', false], ['21:59', false], ['22:00', true]] as const) {
      expect(inQuietHours(Date.parse(`2026-10-21T${iso}:00Z`), p), iso).toBe(esperado)
    }
  })

  it('sin tramo, con un solo extremo o con inicio = fin, nunca hay silencio', () => {
    expect(inQuietHours(NOW, { quiet_start: null, quiet_end: null, timezone: 'UTC' })).toBe(false)
    expect(inQuietHours(NOW, { quiet_start: '22:00', quiet_end: null, timezone: 'UTC' })).toBe(false)
    expect(inQuietHours(NOW, { quiet_start: '10:00', quiet_end: '10:00', timezone: 'UTC' })).toBe(false)
    expect(inQuietHours(NOW, { quiet_start: 'basura', quiet_end: '08:00', timezone: 'UTC' })).toBe(false)
  })

  it('no avisa durante el silencio', () => {
    const now = Date.parse('2026-10-21T23:00:00Z')
    const due = now + 59 * MIN
    expect(plan([{ ...task(0), due_at: new Date(due).toISOString() }], prefs(quiet), new Set(), now)).toEqual([])
  })

  it('un aviso retenido por el silencio se envía al terminar, si la tarea aún no ha vencido', () => {
    // Vence a las 09:00 UTC; "1 h antes" cae a las 08:00 (justo el fin del silencio) y "1 día antes" a las 09:00 del día anterior.
    const due = Date.parse('2026-10-22T09:00:00Z')
    const t: PlanTask = { id: 't1', title: 'X', due_at: new Date(due).toISOString(), assigned_to: 'u1' }
    // Tick a las 08:40 (silencio terminado): el aviso de 2 h antes (07:00) cayó en silencio y se recupera.
    const r = plan([t], prefs({ ...quiet, offsets_minutes: [120] }), new Set(), Date.parse('2026-10-22T08:40:00Z'))
    expect(r.map((x) => x.offsetMinutes)).toEqual([120])
    // Pero no si la tarea ya venció.
    expect(plan([t], prefs({ ...quiet, offsets_minutes: [120] }), new Set(), Date.parse('2026-10-22T09:10:00Z'))).toEqual([])
  })

  it('un aviso que NO cayó en silencio y llegó tarde no se recupera', () => {
    const due = Date.parse('2026-10-21T15:00:00Z')
    const t: PlanTask = { id: 't1', title: 'X', due_at: new Date(due).toISOString(), assigned_to: 'u1' }
    // "1 h antes" = 14:00 (fuera del silencio); tick a las 14:40: 40 min tarde > gracia.
    expect(plan([t], prefs({ ...quiet, offsets_minutes: [60] }), new Set(), Date.parse('2026-10-21T14:40:00Z'))).toEqual([])
  })

  it('el cambio de hora de octubre no desplaza el aviso (se calcula en tiempo absoluto)', () => {
    // 26/10/2026 a las 01:30 UTC termina el horario de verano en Madrid.
    const due = Date.parse('2026-10-26T05:00:00Z')
    const t: PlanTask = { id: 't1', title: 'X', due_at: new Date(due).toISOString(), assigned_to: 'u1' }
    const r = plan([t], prefs({ timezone: 'Europe/Madrid', offsets_minutes: [180] }), new Set(), due - 179 * MIN)
    expect(r.map((x) => x.offsetMinutes)).toEqual([180])
  })
})

describe('formatRemaining', () => {
  it('formatea minutos, horas y días', () => {
    expect(formatRemaining(0)).toBe('menos de 1 min')
    expect(formatRemaining(45)).toBe('45 min')
    expect(formatRemaining(60)).toBe('1 h')
    expect(formatRemaining(90)).toBe('1 h 30 min')
    expect(formatRemaining(24 * 60)).toBe('1 día')
    expect(formatRemaining(3 * 24 * 60 + 5)).toBe('3 días')
    expect(formatRemaining(-5)).toBe('menos de 1 min')
  })
})
